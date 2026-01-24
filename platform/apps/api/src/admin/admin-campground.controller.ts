import { Body, Controller, Post, UseGuards, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

class CreateCampgroundWithAdminDto {
  campground!: {
    name: string;
    slug: string;
    city: string;
    state: string;
    country?: string;
    timezone: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  admin!: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };
}

@Controller("admin/campgrounds")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCampgroundController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles(PlatformRole.platform_admin)
  async createWithAdmin(@Body() dto: CreateCampgroundWithAdminDto) {
    const { campground, admin } = dto;

    // Validate required fields
    if (!campground.name || !campground.slug || !admin.email || !admin.password) {
      throw new BadRequestException("Missing required fields");
    }

    // Check if slug is already taken
    const existingSlug = await this.prisma.campground.findUnique({
      where: { slug: campground.slug },
    });
    if (existingSlug) {
      throw new BadRequestException("A campground with this URL slug already exists");
    }

    // Check if admin email is already taken
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: admin.email },
    });
    if (existingEmail) {
      throw new BadRequestException("A user with this email already exists");
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(admin.password, 10);

    // Create campground and admin user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const organizationId = randomUUID();
      const campgroundId = randomUUID();
      const adminId = randomUUID();

      await tx.organization.create({
        data: {
          id: organizationId,
          name: campground.name,
        },
      });

      // Create the campground
      const newCampground = await tx.campground.create({
        data: {
          id: campgroundId,
          organizationId,
          name: campground.name,
          slug: campground.slug,
          city: campground.city,
          state: campground.state,
          country: campground.country || "USA",
          timezone: campground.timezone,
          phone: campground.phone,
          email: campground.email,
          website: campground.website,
        },
      });

      // Create the admin user with mustChangePassword flag
      const newUser = await tx.user.create({
        data: {
          id: adminId,
          email: admin.email,
          passwordHash,
          firstName: admin.firstName,
          lastName: admin.lastName,
          mustChangePassword: true,
          isActive: true,
        },
      });

      // Create membership linking user to campground as admin
      await tx.campgroundMembership.create({
        data: {
          id: randomUUID(),
          userId: newUser.id,
          campgroundId: newCampground.id,
          role: UserRole.owner,
        },
      });

      return { campground: newCampground, user: newUser };
    });

    return {
      campground: {
        id: result.campground.id,
        name: result.campground.name,
        slug: result.campground.slug,
      },
      admin: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
    };
  }
}
