// validators.js

const nameRegex = /^[A-Za-z]+$/; // letters only, no numbers/symbols
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFirstName(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return "First name must be more than 1 character";
  if (!nameRegex.test(trimmed)) return "First name can only contain letters";
  return "";
}

export function validateLastName(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return "Last name must be more than 1 character";
  if (!nameRegex.test(trimmed)) return "Last name can only contain letters";
  return "";
}

export function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!emailRegex.test(trimmed)) return "Invalid email sequence";
  return "";
}

export function validateCity(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return "City must be more than 1 character";
  if (!nameRegex.test(trimmed)) return "City can only contain letters";
  return "";
}

export function validateCountry(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return "Country must be more than 1 character";
  if (!nameRegex.test(trimmed)) return "Country can only contain letters";
  return "";
}

export function validateDob(value) {
  if (!value) return "Date of birth is required";
  const dobDate = new Date(value);
  const today = new Date();

  let age = today.getFullYear() - dobDate.getFullYear();
  const monthDiff = today.getMonth() - dobDate.getMonth();
  const dayDiff = today.getDate() - dobDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;

  if (age <= 16) return "You must be older than 16 to sign up";
  return "";
}

export function validateGender(value) {
  if (!value) return "Please select a gender";
  return "";
}

export function validatePassword(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 5) return "Password must be more than 5 characters";
  return "";
}

export function validateConfirmPassword(password, confirmPassword) {
  if (password.trim() !== confirmPassword.trim())
    return "Passwords do not match";
  return "";
}

export function validateSignupForm(formData) {
  return {
    firstName: validateFirstName(formData.firstName),
    lastName: validateLastName(formData.lastName),
    email: validateEmail(formData.email),
    dob: validateDob(formData.dob),
    city: validateCity(formData.city),
    country: validateCountry(formData.country),
    gender: validateGender(formData.gender),
    password: validatePassword(formData.password),
    confirmPassword: validateConfirmPassword(
      formData.password,
      formData.confirmPassword,
    ),
  };
}

export function isFormValid(errors) {
  return Object.values(errors).every((err) => err === "");
}
