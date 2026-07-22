import { PrismaClient, AppRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@zebl.local'
  ).toLowerCase();
  const password =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  const hr = await prisma.department.upsert({
    where: { code: 'HR' },
    update: { name: 'Human Resources', deletedAt: null },
    create: {
      name: 'Human Resources',
      code: 'HR',
      description: 'People operations and learning governance',
    },
  });

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: AppRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      departmentId: hr.id,
      deletedAt: null,
      passwordChangedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: AppRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      departmentId: hr.id,
      employeeCode: 'SA-001',
      passwordChangedAt: new Date(),
    },
  });

  console.log(`Seeded Super Admin: ${admin.email}`);
  console.log(`Seeded department: ${hr.code}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
