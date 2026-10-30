
import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

export async function PATCH(request, context) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    });

    // Only admins can manage recovery requests.
    if (!token?.id || token.role !== 'admin') {
      return Response.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const requestId = Number(id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return Response.json(
        { error: 'Invalid request ID.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, assignedTo } = body;

    const allowedStatuses = ['open', 'assigned', 'resolved'];

    if (!allowedStatuses.includes(status)) {
      return Response.json(
        { error: 'Invalid request status.' },
        { status: 400 }
      );
    }

    if (
      assignedTo !== null &&
      (!Number.isInteger(assignedTo) || assignedTo <= 0)
    ) {
      return Response.json(
        { error: 'Invalid assignee.' },
        { status: 400 }
      );
    }

    if (status === 'assigned' && assignedTo === null) {
      return Response.json(
        { error: 'Assign a contributor before setting status to assigned.' },
        { status: 400 }
      );
    }

    const updatedRequest = await withRole(
      token.id,
      token.role,
      async (client) => {
        if (assignedTo !== null) {
          const user = await client.query(
            `SELECT user_id
             FROM app_user
             WHERE user_id = $1
               AND status = 'active'
               AND role = 'contributor'`,
            [assignedTo]
          );

          if (user.rowCount === 0) {
            throw new Error('Assignee must be an active contributor.');
          }
        }

        const result = await client.query(
  `UPDATE recovery_request
   SET assigned_to = $1,
       status = $2::varchar,
       resolved_at = CASE
         WHEN $2::varchar = 'resolved' THEN NOW()
         ELSE NULL
       END
   WHERE request_id = $3
   RETURNING *`,
  [assignedTo, status, requestId]
);

        if (result.rowCount === 0) {
          throw new Error('Recovery request not found.');
        }

        return result.rows[0];
      }
    );

    return Response.json({
      message: 'Recovery request updated successfully.',
      request: updatedRequest,
    });
  } catch (error) {
    console.error('Recovery request update error:', error);

    const knownErrors = [
      'Assignee must be an active contributor.',
      'Recovery request not found.',
    ];

    if (knownErrors.includes(error.message)) {
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json(
      { error: 'Unable to update recovery request.' },
      { status: 500 }
    );
  }
}
