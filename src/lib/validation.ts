import { z } from 'zod';

/**
 * Validation schemas for form inputs
 * These provide both client-side validation and type safety
 */

// Phone number validation - supports Indian format with optional country code
const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  mobileNo: z
    .string()
    .trim()
    .min(1, 'Mobile number is required')
    .max(15, 'Mobile number is too long')
    .regex(phoneRegex, 'Please enter a valid Indian mobile number'),
  address: z
    .string()
    .trim()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(100, 'City name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
});

export const purchaseSchema = z.object({
  customerId: z
    .string()
    .uuid('Invalid customer ID'),
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(100000000, 'Amount exceeds maximum limit'),
  date: z
    .date()
    .max(new Date(), 'Date cannot be in the future'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
});

export const interactionSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  interactionType: z.enum([
    'phone_call',
    'whatsapp',
    'email',
    'in_person',
    'sms',
    'other'
  ]),
  interactionOutcome: z.enum([
    'successful',
    'no_answer',
    'callback_requested',
    'not_interested',
    'order_placed',
    'follow_up_needed',
    'other'
  ]),
  notes: z
    .string()
    .trim()
    .min(1, 'Notes are required')
    .max(2000, 'Notes must be less than 2000 characters'),
  nextFollowupDate: z
    .date()
    .optional()
    .nullable(),
});

export const salespersonSchema = z.object({
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
  mobileNo: z
    .string()
    .trim()
    .max(15, 'Mobile number is too long')
    .regex(phoneRegex, 'Please enter a valid mobile number')
    .optional()
    .or(z.literal('')),
  salary: z
    .number()
    .positive('Salary must be greater than 0')
    .max(100000000, 'Salary exceeds maximum limit')
    .optional()
    .nullable(),
});

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
  mobileNo: z
    .string()
    .trim()
    .max(15, 'Mobile number is too long')
    .optional()
    .or(z.literal('')),
  salary: z
    .number()
    .positive('Salary must be greater than 0')
    .max(100000000, 'Salary exceeds maximum limit')
    .optional()
    .nullable(),
});

// Type exports for use in components
export type CustomerFormData = z.infer<typeof customerSchema>;
export type PurchaseFormData = z.infer<typeof purchaseSchema>;
export type InteractionFormData = z.infer<typeof interactionSchema>;
export type SalespersonFormData = z.infer<typeof salespersonSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;

/**
 * Helper to validate and get first error message
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Return the first error message
  const firstError = result.error.errors[0];
  return { success: false, error: firstError?.message || 'Validation failed' };
}
