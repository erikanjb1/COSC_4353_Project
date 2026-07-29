CREATE DATABASE IF NOT EXISTS QueueSmartDB;
USE QueueSmartDB;

CREATE TABLE IF NOT EXISTS UserCredentials(
    User_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Password VARCHAR(30) NOT NULL,
    Role VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS UserProfile(
    UserProfile_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Email VARCHAR(100) NOT NULL,
    FirstName VARCHAR(30),
    LastName VARCHAR(30),
    Phone_Number VARCHAR(10),
    CONSTRAINT fk_UserProfile_Email FOREIGN KEY (Email) REFERENCES UserCredentials (Email)
);

CREATE TABLE IF NOT EXISTS Service(
    Service_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Service_Name VARCHAR(100),
    Description VARCHAR(300),
    Exected_Duration INT,
    Priority_level VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS Queue(
    Queue_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Service_ID INT,
    Status VARCHAR (30),
    Create_Date DATETIME,
    CONSTRAINT fk_Queue_Service FOREIGN KEY (Service_ID) REFERENCES Service (Service_ID)
);

CREATE TABLE IF NOT EXISTS QueueEntry(
    QueueEntry_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    Queue_ID INT,
    User_ID INT,
    Position INT,
    Join_Time DATETIME,
    Status VARCHAR(30),
    CONSTRAINT fk_QueueEntry_Queue FOREIGN KEY (Queue_ID) REFERENCES Queue (Queue_ID),
    CONSTRAINT fk_QueueEntry_UserCredentials FOREIGN KEY (User_ID) REFERENCES UserCredentials (User_ID)
);

CREATE TABLE IF NOT EXISTS Notification(
    Notification_ID INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    User_ID INT,
    Message VARCHAR(100),
    TimeCode TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(30),
    CONSTRAINT fk_Notification_UserCredentials FOREIGN KEY (User_ID) REFERENCES UserCredentials (User_ID)
);