import app from "./app";
import { initDb } from "./db/init";
import { MYSQL_CONFIG } from "./db/mysql";

const port = process.env.PORT || 3000;

const start = async () => {
  await initDb();
  console.log(`MySQL: ${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);
  app.listen(port, () => {
    console.log(`verifySys API listening on port ${port}`);
  });
};

start().catch((err) => {
  console.error("数据库初始化失败：", err);
  process.exit(1);
});
