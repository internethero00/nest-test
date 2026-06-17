import { DataSourceOptions } from 'typeorm';


export const buildDataSourceOptions = (
  get: (key: string) => string | undefined,
): DataSourceOptions => ({
  type: 'postgres',
  host: get('DB_HOST') ?? 'localhost',
  port: parseInt(get('DB_PORT') ?? '5432', 10),
  username: get('DB_USERNAME') ?? 'postgres',
  password: get('DB_PASSWORD') ?? 'postgres',
  database: get('DB_NAME') ?? 'nest_test',
  // Pick up every *.entity.ts (ts-node) / *.entity.js (compiled) in the project.
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  // Never auto-sync schema; structure is managed exclusively via migrations.
  synchronize: false,
});
