import { z } from 'zod';

export const employeeSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password is too long'),
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Name must be less than 100 characters'),
  department: z
    .string()
    .trim()
    .min(1, 'Department is required')
    .max(100, 'Department must be less than 100 characters'),
  role: z
    .string()
    .trim()
    .min(1, 'Role/Designation is required')
    .max(100, 'Role must be less than 100 characters'),
  salaryType: z.enum(['monthly', 'daily', 'hourly']),
  baseSalary: z
    .number()
    .min(0, 'Base salary cannot be negative')
    .max(100000000, 'Salary exceeds maximum limit'),
  perDayRate: z
    .number()
    .min(0, 'Per day rate cannot be negative')
    .max(1000000, 'Rate exceeds maximum limit'),
  overtimeRate: z
    .number()
    .min(0, 'Overtime rate cannot be negative')
    .max(100000, 'Rate exceeds maximum limit'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  reportingManagerId: z.string().uuid().optional().nullable(),
  mobileNo: z
    .string()
    .trim()
    .max(15, 'Mobile number is too long')
    .optional()
    .or(z.literal('')),
  isSalesPerson: z.boolean(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
