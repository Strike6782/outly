// WHY no DATABASE_URL logging: The connection string may contain credentials
// (username, password) that should never appear in application logs.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
