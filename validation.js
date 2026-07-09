const form = document.querySelector('form')
const username_input = document.getElementById('username-input')
const password_input = document.getElementById('password-input')
const confirm_password_input = document.getElementById('repeat-password-input') 
const error_message = document.getElementById('error-message')
const isRegisterPage = !!confirm_password_input

form.addEventListener('submit', (e) => {
    e.preventDefault()

    let errors = isRegisterPage
        ? getRegisterFormErrors(username_input.value, password_input.value, confirm_password_input.value)
        : getLoginFormErrors(username_input.value, password_input.value)

    if (errors.length > 0) {
        error_message.innerText = errors.join(". ")
    } else {
        error_message.innerText = ''
        // mock success
        if (isRegisterPage) {
            alert('Registration successful! Redirecting to login...')
            window.location.href = 'login.html'
        } else {
            alert('Login successful!')
        }
    }
})

function getLoginFormErrors(username, password) {
    let errors = []
    if (username.trim() === '') {
        errors.push("Username is required")
        username_input.parentElement.classList.add('incorrect')
    } else {
        username_input.parentElement.classList.remove('incorrect')
    }

    if (password === '') {
        errors.push("Password is required")
        password_input.parentElement.classList.add('incorrect')
    } else if (password.length < 8) {
        errors.push("Password must be at least 8 characters")
        password_input.parentElement.classList.add('incorrect')
    } else {
        password_input.parentElement.classList.remove('incorrect')
    }
    return errors
}

function getRegisterFormErrors(email, password, repeatPassword) {
    let errors = []
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (email == null) {
        errors.push("Email is required")
        username_input.parentElement.classList.add('incorrect')
    } else if (!emailRegex.test(email)) {
        errors.push("Please enter a valid email")
        username_input.parentElement.classList.add('incorrect')
    } else {
        username_input.parentElement.classList.remove('incorrect')
    }

    if (password == null) {
        errors.push("Password is required")
        password_input.parentElement.classList.add('incorrect')
    } else if (password.length < 8) {
        errors.push("Password must be at least 8 characters")
        password_input.parentElement.classList.add('incorrect')
    } else {
        password_input.parentElement.classList.remove('incorrect')
    }

    if (repeatPassword === '') {
        errors.push("Please confirm your password")
        confirm_password_input.parentElement.classList.add('incorrect')
    }
    else if (repeatPassword !== password) {
        errors.push("Passwords do not match")
        confirm_password_input.parentElement.classList.add('incorrect')
    }
    else {
        confirm_password_input.parentElement.classList.remove('incorrect')
    }

    return errors
}

const allInputs = [username_input, password_input, confirm_password_input].filter(Boolean)

allInputs.forEach(input => {
    input.addEventListener('input', () => {
        if (input.parentElement.classList.contains('incorrect')) {
            input.parentElement.classList.remove('incorrect')
            error_message.innerText = ''
        }
    })
})
