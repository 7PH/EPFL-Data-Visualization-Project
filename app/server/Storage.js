const mysql = require('promise-mysql');
const Credentials = require('./Credentials');

/**
 *
 */
class Storage {

    /**
     * Connect to mongodb server
     *
     * @return {Promise<void>}
     */
    async connect() {

        if (typeof this.db !== "undefined")
            return;

        this.db = await mysql.createPool({
            connectionLimit: 64,
            host: Storage.DB_HOST,
            user: Storage.DB_USER,
            password: Storage.DB_PASSWORD,
            database: Storage.DB_NAME
        });
    }

    /**
     * Connect to the database
     *
     * @return {Promise<>}
     */
    async truncate() {

        await this.connect();

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS ${Storage.TABLE_MASTER} (
                \`type\` varchar(32) COLLATE utf8_bin NOT NULL,
                \`tms\` int(11) NOT NULL,
                \`url\` varchar(256) COLLATE utf8_bin NOT NULL,
                \`fetched\` int(11) NOT NULL,
                PRIMARY KEY (\`type\`, \`tms\`),
                INDEX(\`type\`, \`tms\`, \`fetched\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;`);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS ${Storage.TABLE_EXPORT} (
                \`id\` int(11) NOT NULL,
                \`actor_name\` varchar(64) COLLATE utf8_bin,
                \`event_code\` varchar(8) COLLATE utf8_bin,
                \`lat\` float,
                \`long\` float,
                \`goldstein\` int(11) NOT NULL,
                \`num_mentions\` int(11) NOT NULL,
                \`tms\` int(11) NOT NULL,
                \`source_url\` varchar(256) COLLATE utf8_bin NOT NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;`);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS ${Storage.TABLE_MENTIONS} (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`event\` int(11) NOT NULL,
                \`tms\` int(11) NOT NULL,
                \`name\` varchar(128) COLLATE utf8_bin NOT NULL,
                \`confidence\` int(11) NOT NULL,
                \`tone\` float NOT NULL,
                PRIMARY KEY (\`id\`),
                INDEX (\`tms\`),
                INDEX (\`tms\`, \`name\`),
                UNIQUE (\`event\`, \`tms\`, \`name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;`);

        await this.db.query(`TRUNCATE ${Storage.TABLE_MASTER}`);
        await this.db.query(`TRUNCATE ${Storage.TABLE_EXPORT}`);
        await this.db.query(`TRUNCATE ${Storage.TABLE_MENTIONS}`);
    }

    /**
     *
     * @param type
     * @param tms
     * @param url
     * @return {Promise<void>}
     */
    insertInMaster(type, tms, url) {
        return this
            .db
            .query(`INSERT INTO ${Storage.TABLE_MASTER}
                    (\`type\`, \`tms\`, \`url\`, \`fetched\`)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE type=?`, [type, tms, url, 0, type]);
    }

    /**
     * Get unfetched files from master
     *
     * @param {'export'|'mentions'} type
     * @param {number|undefined} start tms (sec)
     * @param {number|undefined} end tms (sec)
     * @return {Promise<*>}
     */
    async getUnfetched(type, start, end) {
        start = start || 0;
        end = end || (Date.now() / 1000);
        return await this
            .db
            .query(`SELECT * FROM ${Storage.TABLE_MASTER}
                WHERE
                    type=?
                    AND tms>?
                    AND tms<?
                    AND fetched=?`, [type, start, end, 0]);
    }

    /**
     * Mark something as fetched in the master
     * @param type
     * @param tms
     * @return {Promise<*>}
     */
    async markFetched(type, tms) {
        return await this
            .db
            .query(`UPDATE ${Storage.TABLE_MASTER} SET fetched=? WHERE type=? AND tms=?`, [1, type, tms]);
    }

    /**
     * Insert all events in db
     *
     * @param events
     * @return {Promise<void[]>}
     */
    insertExports(events) {
        return Promise.all(events.map(event => this.insertExport(event)));
    }

    /**
     * Insert an event in database
     *
     * @param {*} event
     * @return {Promise<*>}
     */
    async insertExport(event) {
        return this
            .db
            .query(`INSERT INTO ${Storage.TABLE_EXPORT}
                    (\`id\`, \`actor_name\`, \`event_code\`, \`lat\`, \`long\`, \`goldstein\`, \`num_mentions\`, \`tms\`, \`source_url\`)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE id=id`,
                [event.id, event.actor_name, event.event_code, event.lat, event.long, event.goldstein, event.num_mentions, event.tms, event.source_url]);
    }

    /**
     * Insert all mentions in db
     *
     * @param entries
     * @return {Promise<void[]>}
     */
    insertMentions(entries) {
        return Promise.all(entries.map(entry => this.insertMention(entry)));
    }

    /**
     * Insert an event in database
     *
     * @return {Promise<*>}
     * @param entry
     */
    async insertMention(entry) {
        try {
            return await this
                .db
                .query(`INSERT INTO ${Storage.TABLE_MENTIONS}
                        (\`event\`, \`tms\`, \`name\`, \`confidence\`, \`tone\`)
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE id=id`,
                    [entry.event, entry.tms, entry.name, entry.confidence, entry.tone]);
        } catch (e) {
            return null;
        }
    }

    /**
     *
     * @param {number} start timestamp (sec)
     * @param {number} end timestamp (sec)
     * @param {number} offset
     * @param {number} n
     * @return {Promise<{list: any, topMentions: any, topEvents: any}>}
     */
    async getMentions(start, end, offset, n) {
        const r1 = `SELECT
                        m.id,
                        m.event,
                        m.tone,
                        m.name,
                        e.actor_name,
                        e.event_code,
                        e.lat,
                        e.long,
                        e.tms as event_tms,
                        e.source_url,
                        e.goldstein as event_goldstein
                    FROM ${Storage.TABLE_MENTIONS} as m
                    INNER JOIN \`${Storage.TABLE_EXPORT}\` AS e ON e.id = m.event
                    WHERE m.tms>=? AND m.tms<?
                    LIMIT ?, ?`;
        const r2 = `select r1.name, count(*) as count from (${r1}) r1 group by r1.name having count(*) > 2 order by count(*) desc limit 20`;
        const r3 = `select r1.event, count(*) as count, r1.actor_name, r1.event_code, r1.source_url from (${r1}) r1 group by r1.event having count(*) > 1 order by count(*) desc limit 20`;
        const promises = await Promise.all([r1, r2, r3]
            .map(r => this.db.query(r, [start, end, offset, n])));
        return {
            list: promises[0],
            topMentions: promises[1],
            topEvents: promises[2]
        };
    }

    /**
     * Close the mysql connection
     *
     * @return {Promise<void>}
     */
    async close() {
        this.db.end();
    }
}

Storage.CONNECT_URL = "./data/database.sqlite";
Storage.DB_HOST = 'localhost';
Storage.DB_NAME = 'gdelt_dataviz';
Storage.DB_USER = Credentials.DB_USER;
Storage.DB_PASSWORD = Credentials.DB_PASSWORD;
Storage.TABLE_MASTER = 'master';
Storage.TABLE_EXPORT = "export";
Storage.TABLE_MENTIONS = "mentions";

module.exports = Storage;

