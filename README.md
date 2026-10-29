# \# Lost Knowledge Recovery System

# 

# DBMS MiniProject (Level 3), PES University.

# Team: Vaishnavi (PES1UG24CS514), Tejaswini R Pujar (PES1UG24CS500)

# 

# \## Database setup (PostgreSQL)

# 1\. Create a database named `knowledge\_recovery`.

# 2\. Run these files in order: `db/schema.sql`, `db/seed.sql`, `db/advanced.sql`, `db/security.sql`.

# 3\. Optional: `db/queries.sql` (sample queries) and `db/dml.sql` (INSERT, UPDATE, DELETE examples).

# 

# \## Relational schema

# | Table | Primary key | Foreign keys | Constraints |

# |---|---|---|---|

# | department | dept\_id | none | name UNIQUE, NOT NULL |

# | app\_user | user\_id | dept\_id references department | email UNIQUE; role in (admin, contributor, viewer); status in (active, departed); departure date required when departed |

# | category | category\_id | parent\_id references category | name NOT NULL |

# | knowledge\_item | item\_id | owner\_id references app\_user; category\_id references category | criticality between 1 and 5; status in (draft, published, archived) |

# | item\_version | version\_id | item\_id references knowledge\_item (cascade delete) | UNIQUE (item\_id, version\_no) |

# | tag | tag\_id | none | name UNIQUE |

# | item\_tag | (item\_id, tag\_id) | item\_id references knowledge\_item; tag\_id references tag | both cascade on delete |

# | recovery\_request | request\_id | requester\_id and assigned\_to reference app\_user; item\_id references knowledge\_item | status in (open, assigned, resolved) |

# | audit\_log | log\_id | actor\_id references app\_user | action NOT NULL |

# 

# \## Advanced SQL

# \- Trigger `item\_versioning`: saves the old body in `item\_version` when an item body changes.

# \- Function `fn\_risk\_score(user\_id)`: number of critical items a user owns.

# \- Procedure `transfer\_knowledge(from, to, actor)`: moves a departed user's items and logs it.

# \- Recursive CTE, correlated, nested and join queries: `db/queries.sql`.

# 

# \## Access control

# Database roles `kr\_admin`, `kr\_contributor`, `kr\_viewer`, with row-level security on `knowledge\_item`.

# The API connects as `kr\_app` and switches role for each request.

# 

# \## Technology justification

# PostgreSQL stores structured, rule-heavy data (users, ownership, versions, requests) and gives triggers, procedures, recursive queries and row-level security. Qdrant (vector database) stores embeddings of knowledge text for meaning-based search. Next.js provides the interface and the API.

# 

# \## ER diagram

# See `docs/er-diagram.pdf`.

