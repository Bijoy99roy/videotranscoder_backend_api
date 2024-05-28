import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function seed() {
  await prisma.user.deleteMany()
  const user = await prisma.user.create({ data: { 
    firstName: "Bijoy" ,
    lastName: "Roy",
    email: "test@gmail.com",
    password: "12345"
} })
  
}

seed()
console.log("Seeded")