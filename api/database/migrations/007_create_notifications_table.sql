-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'report_approved', 'report_declined', 'report_archived', 'assignment_created', 'assignment_removed') NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSON,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_read (user_id, `read`),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data (optional - for testing)
-- INSERT INTO notifications (user_id, type, title, message, data) VALUES
-- (7, 'report_approved', 'Report Approved', 'Report #123 has been approved by Admin', '{"report_id": 123}'),
-- (7, 'assignment_created', 'New Assignment', 'You have been assigned to client ABC Corp', '{"client_id": 45}');
