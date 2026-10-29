-- Recursive CTE: category tree
WITH RECURSIVE tree AS (
  SELECT category_id, name, parent_id, 0 AS depth FROM category WHERE parent_id IS NULL
  UNION ALL
  SELECT c.category_id, c.name, c.parent_id, t.depth + 1
  FROM category c JOIN tree t ON c.parent_id = t.category_id
)
SELECT * FROM tree ORDER BY depth, name;

-- Correlated: items more critical than the average in their category
SELECT title, criticality FROM knowledge_item k
WHERE criticality > (SELECT AVG(criticality) FROM knowledge_item WHERE category_id = k.category_id);

-- Nested: users who own no published items
SELECT full_name FROM app_user
WHERE user_id NOT IN (SELECT owner_id FROM knowledge_item WHERE status = 'published');

-- Join: at-risk items (owner has departed)
SELECT k.item_id, k.title, k.criticality, u.full_name AS owner, d.name AS department, c.name AS category
FROM knowledge_item k
JOIN app_user u ON k.owner_id = u.user_id
JOIN department d ON u.dept_id = d.dept_id
LEFT JOIN category c ON k.category_id = c.category_id
WHERE u.status = 'departed' AND k.status <> 'archived';