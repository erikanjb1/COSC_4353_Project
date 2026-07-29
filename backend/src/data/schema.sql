CREATE DATABASE IF NOT EXISTS QueueSmartDB;
USE QueueSmartDB;

CREATE TABLE IF NOT EXISTS UserCredentials(
    User_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    Role ENUM('user', 'administrator') NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS UserProfile(
    UserProfile_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    User_ID INT NOT NULL UNIQUE,
    FirstName VARCHAR(30),
    LastName VARCHAR(30),
    Phone_Number VARCHAR(20),
    CONSTRAINT fk_UserProfile_User FOREIGN KEY (User_ID) REFERENCES UserCredentials (User_ID)
);

CREATE TABLE IF NOT EXISTS Service(
    Service_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Service_Name VARCHAR(100) NOT NULL UNIQUE,
    Description VARCHAR(300) NOT NULL,
    Expected_Duration INT NOT NULL,
    Priority_Level ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
    Is_Open BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT check_Service_Duration CHECK (Expected_Duration BETWEEN 1 AND 240)
);

CREATE TABLE IF NOT EXISTS Queue(
    Queue_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Service_ID INT NOT NULL,
    Status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_Queue_Service FOREIGN KEY (Service_ID) REFERENCES Service (Service_ID)
);

CREATE TABLE IF NOT EXISTS QueueEntry(
    QueueEntry_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Queue_ID INT NOT NULL,
    User_ID INT NOT NULL,
    User_Name VARCHAR(60) NOT NULL,
    Priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
    Position INT,
    Join_Time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Served_At DATETIME NULL,
    Left_At DATETIME NULL,
    Status ENUM('waiting', 'served', 'left') NOT NULL DEFAULT 'waiting',
    CONSTRAINT fk_QueueEntry_Queue FOREIGN KEY (Queue_ID) REFERENCES Queue (Queue_ID),
    CONSTRAINT fk_QueueEntry_UserCredentials FOREIGN KEY (User_ID) REFERENCES UserCredentials (User_ID)
);

CREATE TABLE IF NOT EXISTS Notification(
    Notification_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    User_ID INT NOT NULL,
    Message VARCHAR(255),
    TimeCode TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(30),
    CONSTRAINT fk_Notification_UserCredentials FOREIGN KEY (User_ID) REFERENCES UserCredentials (User_ID)
);