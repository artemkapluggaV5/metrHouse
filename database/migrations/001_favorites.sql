CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL,
    object_id INT NOT NULL,
    PRIMARY KEY (user_id, object_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
) ENGINE = InnoDB;
