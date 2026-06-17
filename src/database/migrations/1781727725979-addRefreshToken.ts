import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshToken1781727725979 implements MigrationInterface {
    name = 'AddRefreshToken1781727725979'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "hashed_refresh_token" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "hashed_refresh_token"`);
    }

}
