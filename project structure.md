## У этого приложения 2 контейнера как видно ниже:

| Контейнер	|  Образ |	Порт |	Назначение |
|-----------|--------|-------|-------------|
| db	    | postgres:13 |	5432	| База данных PostgreSQL |
| backend   |	node-app-db2	| 3000	| Node.js API сервер |

## Схема взаимодействия

![Project Structure](common\project-containers.png "Structure")