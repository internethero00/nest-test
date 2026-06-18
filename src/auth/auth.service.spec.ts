import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByIdWithRefreshToken: jest.fn(),
            create: jest.fn(),
            setRefreshTokenHash: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);

    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    bcryptMock.hash.mockResolvedValue('hashed' as never);
    bcryptMock.compare.mockResolvedValue(true as never);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException when email is already in use', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1' } as never);

      await expect(
        service.register({
          email: 'taken@test.io',
          name: 'A',
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('hashes the password, creates the user and returns a token pair', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        id: 'u1',
        email: 'new@test.io',
        name: 'New',
      } as never);

      const result = await service.register({
        email: 'new@test.io',
        name: 'New',
        password: 'secret123',
      });

      expect(bcryptMock.hash).toHaveBeenCalledWith(
        'secret123',
        expect.any(Number),
      );
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@test.io',
        name: 'New',
        password: 'hashed',
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: 'u1',
        email: 'new@test.io',
        name: 'New',
      });
      // refresh token hash is persisted
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        'u1',
        'hashed',
      );
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@test.io', password: 'secret123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@test.io',
        name: 'A',
        password: 'hashed',
      } as never);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'a@test.io', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns a token pair on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@test.io',
        name: 'A',
        password: 'hashed',
      } as never);

      const result = await service.login({
        email: 'a@test.io',
        password: 'secret123',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({ id: 'u1', email: 'a@test.io', name: 'A' });
    });
  });

  describe('refresh', () => {
    it('throws when no refresh token hash is stored', async () => {
      usersService.findByIdWithRefreshToken.mockResolvedValue({
        id: 'u1',
        hashedRefreshToken: null,
      } as never);

      await expect(service.refresh('u1', 'token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when the refresh token does not match the stored hash', async () => {
      usersService.findByIdWithRefreshToken.mockResolvedValue({
        id: 'u1',
        email: 'a@test.io',
        name: 'A',
        hashedRefreshToken: 'stored',
      } as never);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(service.refresh('u1', 'token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates the tokens on a valid refresh token', async () => {
      usersService.findByIdWithRefreshToken.mockResolvedValue({
        id: 'u1',
        email: 'a@test.io',
        name: 'A',
        hashedRefreshToken: 'stored',
      } as never);

      const result = await service.refresh('u1', 'token');

      expect(result.accessToken).toBe('signed.jwt.token');
      // a fresh refresh token hash is stored (rotation)
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        'u1',
        'hashed',
      );
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token hash', async () => {
      await service.logout('u1');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('u1', null);
    });
  });
});
