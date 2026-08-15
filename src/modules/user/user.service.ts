import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  // Get all users with pagination and search
  async findAll(query: Record<string, any>) {
    try {
      const { search } = query;
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const queryFilter: Record<string, any> = {};
      if (search) {
        queryFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const [totalItems, users] = await Promise.all([
        this.userModel.countDocuments(queryFilter),
        this.userModel.find(queryFilter).sort({ createdAt: -1 }).limit(limit).skip(skip),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        data: users,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      };
    } catch (err) {
      console.error('Error in getAllUsers:', err);
      throw new Error('An error occurred while fetching users.');
    }
  }

  async findById(id: string) {
    const result = await this.userModel.findById(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return result;
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({ email: createUserDto.email });
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }
    return this.userModel.create(createUserDto);
  }

  async remove(id: string) {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User deleted successfully' };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.keys(updateUserDto).forEach((key) => {
      if (key === 'password' && !(updateUserDto as any).password) {
        return;
      }
      (user as any)[key] = (updateUserDto as any)[key];
    });

    try {
      const updatedUser = await user.save();
      const userResponse: any = updatedUser.toObject();
      delete userResponse.password;
      return userResponse;
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('An error occurred: the email may already be in use.');
      }
      console.error('Error in updateUser:', err);
      throw new Error('An error occurred while updating the user.');
    }
  }

  // Change password for an authenticated user
  async changePassword(userId: string | undefined, dto: ChangePasswordDto) {
    if (!userId) {
      throw new UnauthorizedException('Authentication error, user not found.');
    }

    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const isMatch = await user.comparePassword(dto.oldPassword);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect old password');
      }

      // The 'pre.save' hook on the schema automatically hashes the new password
      user.password = dto.newPassword;
      await user.save();

      return { message: 'Password updated successfully' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Error updating password:', err);
      throw new InternalServerErrorException({
        message: 'Internal server error',
        error: (err as Error).message,
      });
    }
  }
}
