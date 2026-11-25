CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('client', 'agent', 'moderator', 'admin') NOT NULL DEFAULT 'client',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE statuses (
    id INT PRIMARY KEY,
    entity_type ENUM('object', 'request') NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(80) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    UNIQUE (entity_type, code)
) ENGINE = InnoDB;

INSERT INTO statuses VALUES
    (1, 'object', 'pending', 'На проверке', 10),
    (2, 'object', 'published', 'Опубликован', 20),
    (3, 'object', 'rejected', 'Отклонён', 30),
    (4, 'object', 'archived', 'В архиве', 40),
    (5, 'request', 'new', 'Новая', 10),
    (6, 'request', 'working', 'В работе', 20),
    (7, 'request', 'done', 'Завершена', 30),
    (8, 'request', 'closed', 'Закрыта', 40);

CREATE TABLE objects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    status_id INT NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    property_type ENUM('flat', 'house', 'office') NOT NULL,
    deal_type ENUM('sale', 'rent') NOT NULL,
    price DECIMAL(15, 2) NOT NULL CHECK (price > 0),
    area DECIMAL(8, 2) NOT NULL CHECK (area > 0),
    rooms SMALLINT UNSIGNED NULL,
    address VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    moderation_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES statuses(id),
    INDEX (status_id, deal_type, price),
    INDEX (status_id, id),
    INDEX (status_id, property_type, price)
) ENGINE = InnoDB;

CREATE TABLE object_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    object_id INT NOT NULL,
    stored_name VARCHAR(100) NOT NULL UNIQUE,
    mime_type VARCHAR(20) NOT NULL,
    width SMALLINT UNSIGNED NOT NULL,
    height SMALLINT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
    INDEX (object_id, sort_order, id)
) ENGINE = InnoDB;

CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    object_id INT NOT NULL,
    client_id INT NOT NULL,
    status_id INT NOT NULL DEFAULT 5,
    phone VARCHAR(30) NOT NULL,
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN status_id IN (5, 6) THEN 1 ELSE NULL END) STORED,
    UNIQUE (client_id, object_id, active_slot),
    INDEX (client_id, created_at),
    FOREIGN KEY (object_id) REFERENCES objects(id),
    FOREIGN KEY (client_id) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES statuses(id)
) ENGINE = InnoDB;

CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL
) ENGINE = InnoDB;

INSERT INTO settings(setting_key, setting_value, description) VALUES
    ('page_size', '6', 'Объектов на странице каталога');
