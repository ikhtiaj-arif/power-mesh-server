import z from "zod";

const ConsumerRegistrationZodSchema = z.object({
  firstName: z
    .string("Not A String!!!!!")
    .min(3, "First Name must atleast 3 characters long!!!")
    .max(10),
  lastName: z
    .string("Not A String!!!!!")
    .min(3, "Last Name must atleast 3 characters long!!!")
    .max(10),
  email: z.email("Not email!!"),
  password: z
    .string()
    .min(8, "Password Must Minimum 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
  consumer: z
    .object({
      contactPhone: z.string().optional(),
      organizationName: z.string().optional(),
      criticalLoadKw: z.number().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
    })
    .optional(),

      
});
const ConsumerVerifyEmailZodSchema = z.object({
  email: z.email("Not email!!"),
  otp: z.string().length(6),
});

const LoginZodSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, "Password Must Minimum 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
});

export const UserValidation = {
  ConsumerRegistrationZodSchema,
  LoginZodSchema,
  ConsumerVerifyEmailZodSchema,
};
