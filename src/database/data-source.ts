import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/typeorm.config';

/**
 * Standalone DataSource used by the TypeORM CLI (migration generate/run/revert).
 * Reads configuration straight from `process.env` (loaded via `dotenv/config`).
 */
export const dataSourceOptions = buildDataSourceOptions((key) => process.env[key]);

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
