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

    const errors = isRegisterPage
        ? validateRegisterForm(
            email,
            password,
            confirmPasswordInput.value
        )
        : validateLoginForm(email, password);

    if (errors.length > 0) {
        errorMessage.innerText = errors.join(". ");
        return;
    }

    try {
        if (isRegisterPage) {
        await registerUser(email, password);
        } else {
        await loginUser(email, password);
        }
    } catch (error) {
        errorMessage.innerText =
        error.message || "Something went wrong.";
    }
});

async function registerUser(email, password) {
    const response = await fetch(
        `${API_BASE_URL}/register`,
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
    email,
    password,
    confirmPassword
    ) {
    const errors = [];
    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    } else if (password.length > 64) {
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