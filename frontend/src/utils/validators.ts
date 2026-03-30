export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone.replace(/\D/g, ""));
};

export const validatePassword = (password: string): IPasswordValidation => {
  const validation: IPasswordValidation = {
    isValid: true,
    errors: [],
  };

  if (password.length < 8) {
    validation.isValid = false;
    validation.errors.push("Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    validation.isValid = false;
    validation.errors.push("Password must contain uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    validation.isValid = false;
    validation.errors.push("Password must contain lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    validation.isValid = false;
    validation.errors.push("Password must contain number");
  }

  return validation;
};

export const validateDateOfBirth = (date: string): boolean => {
  const birthDate = new Date(date);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 && age <= 150;
};

export const validateZipCode = (zipCode: string): boolean => {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
};

export const validateSSN = (ssn: string): boolean => {
  const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
  return ssnRegex.test(ssn);
};

interface IPasswordValidation {
  isValid: boolean;
  errors: string[];
}
