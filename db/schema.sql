CREATE TABLE department (
  dept_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE app_user (
  user_id SERIAL PRIMARY KEY,
  dept_id INT REFERENCES department(dept_id),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','contributor','viewer')),
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','departed')),
  departed_on DATE,
  CHECK (status = 'active' OR departed_on IS NOT NULL)
);

CREATE TABLE category (
  category_id SERIAL PRIMARY KEY,
  parent_id INT REFERENCES category(category_id),
  name VARCHAR(100) NOT NULL
);

CREATE TABLE knowledge_item (
  item_id SERIAL PRIMARY KEY,
  owner_id INT NOT NULL REFERENCES app_user(user_id),
  category_id INT REFERENCES category(category_id),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  criticality SMALLINT NOT NULL CHECK (criticality BETWEEN 1 AND 5),
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE item_version (
  version_id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES knowledge_item(item_id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  body TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (item_id, version_no)
);

CREATE TABLE tag (
  tag_id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE item_tag (
  item_id INT NOT NULL REFERENCES knowledge_item(item_id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE recovery_request (
  request_id SERIAL PRIMARY KEY,
  requester_id INT NOT NULL REFERENCES app_user(user_id),
  item_id INT REFERENCES knowledge_item(item_id),
  assigned_to INT REFERENCES app_user(user_id),
  topic VARCHAR(200) NOT NULL,
  details TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
  log_id SERIAL PRIMARY KEY,
  actor_id INT REFERENCES app_user(user_id),
  action VARCHAR(50) NOT NULL,
  target_table VARCHAR(50),
  target_id INT,
  details TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);