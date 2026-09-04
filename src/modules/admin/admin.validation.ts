import z from "zod";

const BlockUserZodSchema = z.object({
  isBlocked: z.boolean(),
  reason: z.string().max(500).optional(),
});

const UserIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
});

export const AdminValidation = {
  BlockUserZodSchema,
  UserIdParamZodSchema,
};
