-- VerifySys local database export
-- Source: local MySQL 127.0.0.1:3306 / database dbs
-- Generated for importing into the 1Panel MySQL database selected in .env
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `verify_users`;
DROP TABLE IF EXISTS `verify_user_roles`;
DROP TABLE IF EXISTS `verify_system_config`;
DROP TABLE IF EXISTS `verify_security_policies`;
DROP TABLE IF EXISTS `verify_roles`;
DROP TABLE IF EXISTS `verify_register_codes`;
DROP TABLE IF EXISTS `verify_projects`;
DROP TABLE IF EXISTS `verify_products`;
DROP TABLE IF EXISTS `verify_orders`;
DROP TABLE IF EXISTS `verify_notifications`;
DROP TABLE IF EXISTS `verify_menus`;
DROP TABLE IF EXISTS `verify_logs`;
DROP TABLE IF EXISTS `verify_email_codes`;
DROP TABLE IF EXISTS `verify_departments`;
DROP TABLE IF EXISTS `verify_custom_data`;

--
-- Table structure for verify_custom_data
--
CREATE TABLE `verify_custom_data` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `key` varchar(64) NOT NULL,
  `value` text NOT NULL,
  `created_at` bigint NOT NULL,
  `remark` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_custom_data (1 rows)
--
INSERT INTO `verify_custom_data` (`id`, `project_id`, `key`, `value`, `created_at`, `remark`) VALUES
  ('72b1666f-d1c7-40b6-9b4b-85daec71ead3', '4297c7b3-e8bd-447d-8dce-438d9c89948a', 'modelpwd', 'chilunbugeiniyong', 1765800255928, '备注信息');

--
-- Table structure for verify_departments
--
CREATE TABLE `verify_departments` (
  `id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `parent_id` varchar(64) DEFAULT NULL,
  `sort` int NOT NULL DEFAULT '0',
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_departments (0 rows)
--

--
-- Table structure for verify_email_codes
--
CREATE TABLE `verify_email_codes` (
  `id` varchar(64) NOT NULL,
  `email` varchar(128) NOT NULL,
  `code` varchar(16) NOT NULL,
  `purpose` varchar(16) NOT NULL,
  `expire_at` bigint NOT NULL,
  `used_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email_purpose_created` (`email`,`purpose`,`created_at`),
  KEY `idx_expire_at` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_email_codes (4 rows)
--
INSERT INTO `verify_email_codes` (`id`, `email`, `code`, `purpose`, `expire_at`, `used_at`, `created_at`) VALUES
  ('390e51a6-c488-48f2-b39c-a34d023d72db', '186****8535@mobile.local', '401344', 'reset', 1776586050745, 1776585450752, 1776585450745),
  ('861de641-e74d-4807-8b47-2eee122a0262', 'zhaienguang@qq.com', '451933', 'reset', 1765806877784, 1776585456294, 1765806277784),
  ('e5fc6c1a-f324-4f65-81b9-5cd610165988', 'zhaienguang@qq.com', '360844', 'reset', 1765806757739, 1776585456294, 1765806157739),
  ('f6bfd977-7870-42a9-9b65-3f07fead871a', 'zhaienguang@qq.com', '928599', 'reset', 1776586056294, 1776585456308, 1776585456294);

--
-- Table structure for verify_logs
--
CREATE TABLE `verify_logs` (
  `id` varchar(64) NOT NULL,
  `log_type` varchar(16) NOT NULL,
  `action` varchar(128) DEFAULT NULL,
  `user` varchar(64) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `message` text,
  `stack` text,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_logs (65 rows)
--
INSERT INTO `verify_logs` (`id`, `log_type`, `action`, `user`, `status`, `ip`, `message`, `stack`, `created_at`) VALUES
  ('03d356c6-a5cd-42da-a159-ae3c082afb16', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776511680178),
  ('0bdbe3c5-f514-48b8-8848-a3d67293400d', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776426447616),
  ('11425cfa-8383-4d38-ab06-bf430358ecc0', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776586128994),
  ('134ba027-f83c-42ea-a32a-5d01b18a401f', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776433826998),
  ('220e1907-92f1-4040-b1df-18dd3683cbc7', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765798843163),
  ('22b2a6f1-0aa3-4c0b-b0e9-20e845e7a4f9', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776526671495),
  ('23c96d4d-6dc4-4b16-bc96-70e04558dc80', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776426451987),
  ('2a53e82f-1ead-4306-beee-67b62bae5580', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825305253),
  ('2b4b2060-f3c0-45b8-bbf6-6689b4fd4388', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776410420302),
  ('2bb3c33d-6dc0-4cd4-8384-f64a325282a0', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765801718285),
  ('2d14c669-8661-42f5-9378-939c684b27ef', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825324019),
  ('2e5807f3-f9a1-4fda-b3c9-653c1fc9310b', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1777564192467),
  ('2f67bde0-7f6f-4dd8-8478-fdf79483502b', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776410422163),
  ('2f776ede-19ac-4e2b-a5ff-712720aa23ca', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765728642436),
  ('308aa78a-5220-427a-9457-989d1df487db', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776533382252),
  ('333d1063-a6ae-44e3-b0b0-f5c56fee6a49', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1777564186647),
  ('33e1746c-46c9-4ff8-9b68-180b4756c948', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776410258624),
  ('3919c09e-5f51-4e96-8e62-e354c4f3ed69', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776571243538),
  ('4aaeece4-db62-41e2-9a5a-05b0251ee54c', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776410262228),
  ('51513094-f4ac-4494-882b-727a5a5f2b68', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776419070248),
  ('51fc4327-f83c-4405-bc60-37cbd3d5e3af', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776516965833),
  ('58273c13-00a5-4fc0-8518-163e5159ea91', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765790766696),
  ('5af0be7c-6356-414a-a0a0-a79a256cdb27', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776410567499),
  ('5c3b3f0f-ccb4-4578-aa2c-5ae0fde6b0c5', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776675446468),
  ('6291501e-2e30-48bc-8dbd-375fbbb4010a', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765794235687),
  ('655884c2-241d-4ba7-89b0-acde2709b0ca', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776445183669),
  ('6e1d9739-9a16-4547-a298-3e16baf2079d', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776522021702),
  ('74b69290-13b6-48b0-b2b0-1ac032572da0', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776662646130),
  ('80a39508-f3e1-42bf-ae7a-0ccf60bbddfe', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825451282),
  ('82419a1c-0d4f-461f-b239-ae67be61ccc8', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776745020629),
  ('82d9dd8c-512d-4598-9af6-05c6950a5574', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776493256713),
  ('8b4608c6-1a34-46df-bc89-ae3cba23b47b', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776509921255),
  ('8b60117c-34d7-49fe-a95b-76d768d6df39', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825456581),
  ('9a42d3b7-7bcd-40e3-9e9b-b3e5e66541fa', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1777564190900),
  ('9b548a3c-c5f0-4b10-8c87-497be51a7039', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776426462975),
  ('9cc3352f-54a3-4e9a-87ac-986ec95cf058', 'login', NULL, 'admin', 'disabled', '::1', NULL, NULL, 1765824591061),
  ('9d556d84-73ae-4bfd-8957-9f838e9a0ec8', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776486919005),
  ('a632d70a-5888-45dd-8d22-5796f74bff6e', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765764830690),
  ('a9556230-e93a-4dae-84a2-145b1168ec01', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825235968),
  ('b074a0ec-3921-4671-8ae7-d740fbdaab73', 'login', NULL, 'admins', 'bad_password', '::1', NULL, NULL, 1776419051809),
  ('b233fe92-fd5a-4184-8017-6bb318905ea2', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765797427678),
  ('b72878be-a8ec-4e1d-bf17-f409d0443bdf', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776516624436),
  ('b8c9ca7e-3ef9-4501-9cd3-1e7b3af5e20e', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1765825232123),
  ('bb09aa9d-0c5d-4fe2-a6c7-00dde7e69a83', 'login', NULL, 'test001', 'bad_password', '::1', NULL, NULL, 1776410276072),
  ('beedad0e-cf43-4b3f-9a8a-dad3f3de24b7', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776501046659),
  ('c14995d9-ff10-4dd4-bcb9-c0232dbb946d', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825273927),
  ('c1f795d6-5590-4bec-a2e6-a8721f01b99f', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765824718952),
  ('c46853ee-cf3b-431f-9f15-1541fd5c1381', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765824621741),
  ('c995ebbb-afac-41c6-a500-6a5191d15f5b', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765797266005),
  ('cdde014d-c4dd-40bd-a757-faf0ca9f49a1', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765720736243),
  ('d14d2753-d22b-4967-a3d8-0b1b129cf26d', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776578747173),
  ('d20838e1-e769-4076-ac01-5cc30558e9cf', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1776410215267),
  ('d3091bca-0422-415e-a8d6-e2b4bf86242d', 'login', NULL, 'admin', 'bad_password', '::1', NULL, NULL, 1765824714387),
  ('d4d90976-b9df-45bc-941b-fa65d00ba7de', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765767468141),
  ('d66e5ead-2b97-442e-b314-0547d032935d', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765824695552),
  ('d8c17723-48fc-4c41-98b5-231a72dda4c7', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765814320444),
  ('e160800a-db75-494e-a05c-0e3258fdc815', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765798746126),
  ('e1ac15cc-a0ba-4766-a50b-c909af715573', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776655080991),
  ('e3096ec8-08a1-413f-8821-d922c31cf687', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776435157905),
  ('e8641819-980c-4f3a-b708-1c0284dd8114', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825469281),
  ('f613b47d-2a15-488a-95a9-2530951d3f17', 'login', NULL, 'admins', 'disabled', '::1', NULL, NULL, 1776493218539),
  ('f7e2e4d2-359c-4fdd-9b47-d94d90c10d07', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825510739),
  ('fb99c455-da52-48e2-bb91-4904cf6340fa', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765709495747),
  ('fd0698e5-94b1-4737-9542-bbb9c2e79477', 'login', NULL, 'admins', 'success', '::1', NULL, NULL, 1776517191146),
  ('fd74d00f-c2eb-4256-8bf2-862f88801ad4', 'login', NULL, 'admin', 'success', '::1', NULL, NULL, 1765825315574);

--
-- Table structure for verify_menus
--
CREATE TABLE `verify_menus` (
  `id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `path` varchar(255) NOT NULL,
  `parent_id` varchar(64) DEFAULT NULL,
  `icon` varchar(64) DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `sort` int NOT NULL DEFAULT '0',
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_menus (16 rows)
--
INSERT INTO `verify_menus` (`id`, `name`, `path`, `parent_id`, `icon`, `permissions`, `sort`, `created_at`) VALUES
  ('codes', '注册码管理', '/codes', NULL, 'Tickets', NULL, 7, 1765653760497),
  ('codes-generate', '注册码生成', '/codes/generate', 'codes', NULL, NULL, 2, 1765653760497),
  ('codes-list', '注册码列表', '/codes/list', 'codes', NULL, NULL, 1, 1765653760497),
  ('custom-data', '自定义数据', '/custom-data', NULL, 'DataAnalysis', NULL, 9, 1765653760497),
  ('dashboard', '首页', '/dashboard', NULL, 'House', NULL, 1, 1765653760497),
  ('departments', '部门管理', '/departments', NULL, 'OfficeBuilding', NULL, 5, 1765653760497),
  ('logs', '系统日志', '/logs', NULL, 'Document', NULL, 11, 1765653760497),
  ('menus', '菜单管理', '/menus', NULL, 'Menu', NULL, 4, 1765653760497),
  ('products', '商品管理', '/products', NULL, 'ShoppingCart', NULL, 8, 1765653760497),
  ('profile', '个人中心', '/profile', NULL, 'Avatar', NULL, 12, 1765653760497),
  ('projects', '项目管理', '/projects', NULL, 'Collection', NULL, 6, 1765653760497),
  ('projects-create', '新建项目', '/projects/create', 'projects', NULL, NULL, 2, 1765653760497),
  ('projects-list', '项目管理', '/projects/list', 'projects', NULL, NULL, 1, 1765653760497),
  ('roles', '角色管理', '/roles', NULL, 'Key', NULL, 3, 1765653760497),
  ('security-policies', '安全策略管理', '/security-policies', NULL, 'ShieldCheck', NULL, 10, 1765653760497),
  ('users', '用户管理', '/users', NULL, 'User', NULL, 2, 1765653760497);

--
-- Table structure for verify_notifications
--
CREATE TABLE `verify_notifications` (
  `id` varchar(64) NOT NULL,
  `title` varchar(128) NOT NULL,
  `content` text NOT NULL,
  `category` varchar(16) NOT NULL,
  `is_read` tinyint NOT NULL DEFAULT '0',
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_notifications (2 rows)
--
INSERT INTO `verify_notifications` (`id`, `title`, `content`, `category`, `is_read`, `created_at`) VALUES
  ('n-1', '欢迎使用', '系统已初始化完毕。', 'system', 0, 1765653760497),
  ('n-2', '待办事项', '请完善项目配置。', 'todo', 0, 1765653760497);

--
-- Table structure for verify_orders
--
CREATE TABLE `verify_orders` (
  `id` varchar(64) NOT NULL,
  `product_id` varchar(64) NOT NULL,
  `buyer` varchar(128) NOT NULL,
  `quantity` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(16) NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_orders (0 rows)
--

--
-- Table structure for verify_products
--
CREATE TABLE `verify_products` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `summary` varchar(255) DEFAULT NULL,
  `allow_anonymous` tinyint NOT NULL DEFAULT '1',
  `min_buy` int NOT NULL DEFAULT '1',
  `max_buy` int NOT NULL DEFAULT '5',
  `variants` json NOT NULL,
  `description` text,
  `link_code` varchar(64) NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `link_code` (`link_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_products (0 rows)
--

--
-- Table structure for verify_projects
--
CREATE TABLE `verify_projects` (
  `id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `config` json NOT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  `project_no` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `uniq_project_no` (`project_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_projects (2 rows)
--
INSERT INTO `verify_projects` (`id`, `name`, `description`, `config`, `created_at`, `updated_at`, `project_no`) VALUES
  ('4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', '公告信息', '[object Object]', 1765656803310, 1765656803310, 2),
  ('p-1', '默认项目', '演示用例', '[object Object]', 1765653760497, 1765653760497, 1);

--
-- Table structure for verify_register_codes
--
CREATE TABLE `verify_register_codes` (
  `id` varchar(64) NOT NULL,
  `code` varchar(32) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `project_name` varchar(64) NOT NULL,
  `card_type` varchar(32) NOT NULL,
  `status` varchar(16) NOT NULL,
  `is_online` tinyint NOT NULL DEFAULT '0',
  `is_bound` tinyint NOT NULL DEFAULT '0',
  `sale_type` varchar(32) DEFAULT NULL,
  `machine_code` varchar(128) DEFAULT NULL,
  `last_login_ip` varchar(64) DEFAULT NULL,
  `last_login_at` bigint DEFAULT NULL,
  `activated_at` bigint DEFAULT NULL,
  `unbind_password` varchar(64) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `expire_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `customer_info` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_register_codes (36 rows)
--
INSERT INTO `verify_register_codes` (`id`, `code`, `project_id`, `project_name`, `card_type`, `status`, `is_online`, `is_bound`, `sale_type`, `machine_code`, `last_login_ip`, `last_login_at`, `activated_at`, `unbind_password`, `remark`, `expire_at`, `created_at`, `customer_info`) VALUES
  ('01d4ae9d-9534-4468-9d7b-c214e6bd9507', '48C812DFB644CAC0D3148114EBE63EBC', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('05247085-ea38-417d-a3db-19367ab3a290', 'B746E1597B85D0BCC70AD5BA3A1DBB70', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('05517082-33ad-4f24-88ed-31627d1d62a2', '139CE4AF2A71FD03915C728E7F420CAD', 'p-1', '默认项目', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('12dd1906-f736-4a0a-8b3a-ae59814104f9', 'CDA864F55BC836A7B13C6E7173112F55', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('152cdc93-9ed5-4088-8e9d-08f7af42f293', 'E81915CF562794DDEFB283A385E1FFEB', 'p-1', '默认项目', 'quarter', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '测试的季卡', NULL, 1776506995129, NULL),
  ('1eec39ac-bb09-4012-b17e-2afe63eb0de1', '11758481D1F0573A2A99C37DF85381DF', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时123', NULL, 1765716442992, NULL),
  ('25fa23bc-8645-4136-a3f5-6bab1b0164d5', 'BD06C53156027B8600095D79769324E8', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('2a56a90f-5e97-4075-8745-f949d347366a', '01EB38BC2575FCF3E452033887610A9F', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('2b82f685-081c-41c3-bec6-48c0a99be855', '3631E100F71E8BF51BF7595BB218B3D9', 'p-1', '默认项目', 'quarter', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '测试的季卡', NULL, 1776506995129, NULL),
  ('305dacb8-d7de-4f47-8959-3475ed0b0efb', '7A7F4D3B905A6237E220612FDB532797', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('4735ac9f-7606-426d-bd2f-051e17aa5486', '2E624755ED4CD8662676E3AB33FF3BBF', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('4c4f8ae3-0753-4668-9200-fb926c15a5d5', '430DC7134706BE6BEFC4348E5B17FD11', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('51f3e717-b019-46ee-9889-5880ca51cf29', 'D347551EFF294C8270FE504653AAB1F7', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('55405dd6-b064-4082-a07b-ca21ac1848d0', 'EF118DB45C098D476B2F09A7BD380BC5', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('59f5a861-dc72-4fcf-9914-6a841e4690ac', '696AE620B80A2CCCA0C24C8ACE55A1AC', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('5a7be68d-f3c3-4952-876c-4a8108e43e84', '27D41821D9445F6D66A8C83A5DA1478D', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('5eeb8a03-089b-4e7d-ac44-d8ddcbcc0b37', 'D7685CECB351CEBBDC56447BC022173A', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('60af0295-7bb7-47da-a810-55ace23b2156', 'wddw666', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'permanent', 'in_use', 0, 0, 'author_generated', NULL, NULL, NULL, 1770874560000, '123456', NULL, 2086407360000, 1776579806830, NULL),
  ('637b9f9c-2f74-4804-a447-c351ee330e4f', 'BBB88809350DA3426C96D91BBF6A9FB0', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('67c8c296-3dd2-4deb-bd13-6b5b25854ab0', '67EB387457F29EBD900EB7E3F88CE44D', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('6c908dee-b173-493d-abc7-309928cd5f47', '9FA73A5BD5F844FF1DF939CE7A497DC0', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('7a24bb2e-3b95-4890-be73-e502d50fe6b9', '66CD7CDF3B04D82361E1A883C5E27A73', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('7c2e808a-8296-4d41-8f1d-1c615aa1726a', 'B8413BCC068E18465D47C03252DD42C4', 'p-1', '默认项目', 'quarter', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '这是备注信息', NULL, 1776506995129, NULL),
  ('83686c9e-c13e-4e43-8db2-1de342125f0d', '65C64C93938D5B626BAE9BA98F8C173F', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('92889cbf-3bbd-4c34-acc9-043d96b25336', 'AE0A574F736993FFA925E44C5079328E', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'quarter', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, '123456', '测试的季卡', NULL, 1776506995129, NULL),
  ('94d55d52-499c-4545-bf62-2381474d86de', '34E0881BA5324DDEA50B7BDB4038724B', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('98e4670f-901c-4e1c-9f40-a33a3b6fd060', '67FDC4E08D7DADC767D75F9A689F6B7E', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('a536d79b-45c1-4534-9ab9-b237f3c4aba6', '1BABC85EB382795E713E7BDC98552AD8', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('b1fa2283-9ee3-4bf3-957b-7e805cbd28bf', '36E085083B2BF06AA2C24D9D0347CC8E', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716237941, NULL),
  ('b2fa06da-0c2d-4837-8e02-bb69e8d379f8', '628DA45889D193379F7C408958BEC0BE', 'p-1', '默认项目', 'quarter', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '测试的季卡', NULL, 1776506995129, NULL),
  ('c7b0f38b-4d6a-4065-b448-9ecd93c2e626', 'C2FD4A0AE3DE1A0E07BA9F5DDA20FE4E', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL),
  ('cf7e2917-6696-4a4e-a61d-a142b1f5a91e', 'F1C62EE878D94D1233F7B73ACE27199B', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('d2cc751a-d7c6-4f48-81fe-9179a192701e', '269586CAF116D7AE0616C68026142009', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('e00de0a2-0517-4a88-a8ce-281e2736a155', '5A5904F66253F6F5AFC9368502DE5320', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'month', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '月卡x10', NULL, 1765716242734, NULL),
  ('e4c6c71e-5d57-4c49-869d-a16acb7f8d7e', 'C4995E439B3CA21999D3AC0737AED1AB', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'hour', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '小时卡x10', NULL, 1765716442992, NULL),
  ('e75ce7a9-f73f-404a-a1ab-091d138d8720', 'DD676A54A22E12BD57E87BF4F248D9BF', '4297c7b3-e8bd-447d-8dce-438d9c89948a', '项目222', 'day', 'unused', 0, 0, 'author_generated', NULL, NULL, NULL, NULL, NULL, '天卡x10', NULL, 1765731023393, NULL);

--
-- Table structure for verify_roles
--
CREATE TABLE `verify_roles` (
  `id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `permissions` json NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_roles (2 rows)
--
INSERT INTO `verify_roles` (`id`, `name`, `description`, `permissions`, `created_at`) VALUES
  ('role-admin', '管理员', '系统管理员', '*', 1765653760497),
  ('role-ops', '运营', '运营与客服', 'dashboard,users,codes,projects,products', 1765653760497);

--
-- Table structure for verify_security_policies
--
CREATE TABLE `verify_security_policies` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `mode` varchar(64) NOT NULL,
  `status` varchar(16) NOT NULL,
  `created_at` bigint NOT NULL,
  `config` json DEFAULT NULL,
  `updated_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_security_policies (2 rows)
--
INSERT INTO `verify_security_policies` (`id`, `project_id`, `name`, `mode`, `status`, `created_at`, `config`, `updated_at`) VALUES
  ('44314e5f-7288-4557-97c9-b58c357ef84b', 'p-1', 'default', 'basic', 'enabled', 1765824080521, '[object Object]', 1765824080521),
  ('c3dae39f-6670-4fae-b7ff-0014d12803e3', '4297c7b3-e8bd-447d-8dce-438d9c89948a', 'default', 'basic', 'enabled', 1765822813689, '[object Object]', 1765822813689);

--
-- Table structure for verify_system_config
--
CREATE TABLE `verify_system_config` (
  `id` int NOT NULL,
  `config` json NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_system_config (1 rows)
--
INSERT INTO `verify_system_config` (`id`, `config`, `updated_at`) VALUES
  (1, '[object Object]', 1765653760497);

--
-- Table structure for verify_user_roles
--
CREATE TABLE `verify_user_roles` (
  `user_id` varchar(64) NOT NULL,
  `role_id` varchar(64) NOT NULL,
  PRIMARY KEY (`user_id`,`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_user_roles (2 rows)
--
INSERT INTO `verify_user_roles` (`user_id`, `role_id`) VALUES
  ('u-admin', 'role-admin'),
  ('u-admins', 'role-admin');

--
-- Table structure for verify_users
--
CREATE TABLE `verify_users` (
  `id` varchar(64) NOT NULL,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(128) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `email` varchar(128) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `department_id` varchar(64) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Data for verify_users (3 rows)
--
INSERT INTO `verify_users` (`id`, `username`, `password_hash`, `status`, `email`, `phone`, `department_id`, `remark`, `avatar`, `created_at`, `updated_at`) VALUES
  ('2d908ac4-231e-4eb8-9223-c5bea00f37e6', 'test001', '$2b$10$sBR4Di0OlpXtSva9XrpC3.nU1C3KEQBaUyRrkKcK0DVisx3HJ4wny', 'active', 'chilun@baidu.com', NULL, NULL, NULL, NULL, 1765824567625, 1765824661048),
  ('u-admin', 'admin', '$2b$10$ViDr.Mye5SdYRsghKYswL.GHZkU7NPg8vGWDn/B07Mwdr8D3O7m.m', 'active', 'admin@example.com', '18800000000', NULL, '系统管理员', NULL, 1765653760497, 1765825264654),
  ('u-admins', 'admins', '$2b$10$lXEulkycyTveMEZsrb2DtOPISR28yAcoLPvHTGSZFBYy4GXOhn2tO', 'active', 'zhaienguang@qq.com', NULL, NULL, 'manual admin insert', NULL, 1776410514690, 1776492877962);

SET FOREIGN_KEY_CHECKS = 1;
