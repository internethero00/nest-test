import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /** Find a user by email. Password is excluded unless explicitly requested. */
  findByEmail(email: string, withPassword = false): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: withPassword
        ? { id: true, email: true, name: true, password: true }
        : undefined,
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /** Find a user by id including the (normally hidden) refresh token hash. */
  findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      select: { id: true, email: true, name: true, hashedRefreshToken: true },
    });
  }

  /** Persist a new user. Expects the password to be already hashed. */
  create(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  /** Store (or clear, when null) the bcrypt hash of the user's current refresh token. */
  async setRefreshTokenHash(
    userId: string,
    hash: string | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, { hashedRefreshToken: hash });
  }
}
