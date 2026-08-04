const API_BASE_URL = "/api/auth";

const form = document.querySelector("form");
const emailInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const confirmPasswordInput = document.getElementById("repeat-password-input");
const errorMessage = document.getElementById("error-message");

const isRegisterPage = Boolean(confirmPasswordInput);

form.addEventListener('submit',async function (event) {
    event.preventDefault();

    errorMessage.innerText = "";
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let errors = [];

    if (isRegisterPage) {
        const firstName =
            document.getElementById("fname-input").value.trim();

        const lastName =
            document.getElementById("lname-input").value.trim();

        const phoneNumber =
            document.getElementById("phonenumber-input").value.trim();

        errors = validateRegisterForm(
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            confirmPasswordInput.value
        );

        if (errors.length > 0) {
            errorMessage.innerText = errors.join(". ");
            return;
        }

        try {
            await registerUser( firstName, lastName, email, phoneNumber, password );
        } catch (error) {
            errorMessage.innerText =
                error.message || "Something went wrong."; }
    } else {
        errors = validateLoginForm(
            email,
            password );
        if (errors.length > 0) {
            errorMessage.innerText = errors.join(". ");
            return; }
        try {
            await loginUser(
                email,
                password );
        } catch (error) {
            errorMessage.innerText =
                error.message || "Something went wrong.";
        }
    }
});

async function registerUser(firstName, lastName, email, phoneNumber, password) {
    const response = await fetch(
        `${API_BASE_URL}/register`,
        {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            firstName,
            lastName,
            email,
            phoneNumber,
            password
        })
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(getErrorMessage(result));
    }

    alert("Registration successful. Please log in.");

    window.location.href = "/login";
}

async function loginUser(email, password) {
    const response = await fetch(
        `${API_BASE_URL}/login`,
        {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(getErrorMessage(result));
    }

    const user = result.data.user;
    const token = result.data.token;

    localStorage.setItem(
        "currentUser",
        JSON.stringify(user)
    );

    localStorage.setItem("authToken", token);

    if (user.role === "administrator") {
        window.location.href = "/admin";
    } else {
        window.location.href = "/";
    }
}

function validateLoginForm(email, password) {
    const errors = [];

    if (email === "") {
        errors.push("Email is required");
    }

    if (password === "") {
        errors.push("Password is required");
    }

    return errors;
}

function validateRegisterForm(
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    confirmPassword
    ) {
    const errors = [];

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (firstName === "") {
        errors.push("First name is required");
    } else if (firstName.length > 30) {
        errors.push(
            "First name must not exceed 30 characters"
        );
    }

    if (lastName === "") {
        errors.push("Last name is required");
    } else if (lastName.length > 30) {
        errors.push(
            "Last name must not exceed 30 characters"
        );
    }

    if (phoneNumber.length > 20) {
        errors.push(
            "Phone number must not exceed 20 characters"
        );
    }
      
    if (email === "") {
        errors.push("Email is required");
    } else if (!emailPattern.test(email)) {
        errors.push("Enter a valid email");
    } else if (email.length > 100) {
        errors.push(
        "Email must not exceed 100 characters"
        );
    }

    if (password === "") {
        errors.push("Password is required");
    } else if (password.length < 8) {
        errors.push(
        "Password must be at least 8 characters"
        );
    } else if (password.length > 30) {
        errors.push(
        "Password must not exceed 64 characters"
        );
    }

    if (confirmPassword === "") {
        errors.push("Please confirm your password");
    } else if (password !== confirmPassword) {
        errors.push("Passwords do not match");
    }

    return errors;
}

function getErrorMessage(result) {
    if (
        Array.isArray(result.error?.details) &&
        result.error.details.length > 0
    ) {
        return result.error.details.join(". ");
    }

    return (
        result.error?.message ||
        result.message ||
        "The request could not be completed."
    );
}