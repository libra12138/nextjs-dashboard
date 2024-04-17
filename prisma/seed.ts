import { PrismaClient } from '@prisma/client';
import {
  users,
  customers,
  invoices,
  revenue,
} from './placeholder-data';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
async function main() {
  const newUsers = [];
  for (let i = 0; i < users.length; i++) {
    newUsers.push({
      ...users[i],
      password: await bcrypt.hash(users[i].password, 10),
    });
  }
  const insertedUsers = await prisma.users.createMany({
    data: newUsers,
  });

  const insertedInvoices = await prisma.invoices.createMany({
    data: invoices,
  });

  const insertedCustomers = await prisma.customers.createMany({
    data: customers,
  });

  const insertedRevenue = await prisma.revenue.createMany({
    data: revenue,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
