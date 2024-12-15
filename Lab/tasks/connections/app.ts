import axios from "axios";
import neo4j from 'neo4j-driver';
import { AiDevsService } from "../../services/ai-devs.service";


const dbApi = 'https://centrala.ag3nts.org/apidb';
const queryUsers = {task: 'database', apikey: process.env.AIDEVS_KEY, query: 'select * from users'};
const queryUConnections = {task: 'database', apikey: process.env.AIDEVS_KEY, query: 'select * from connections'};

const responseUsers = await axios.post(dbApi, queryUsers);
const users: 
    [
        {id: string, username: string, access_level: string, is_active: string, lastlog: string}
    ] = responseUsers.data.reply;

const responseConnections = await axios.post(dbApi, queryUConnections);
const connections: 
    [
        {user1_id: string, user2_id: string}
    ] = responseConnections.data.reply;

const neo4jUrl = 'bolt://192.168.1.22:7687';

const driver = neo4j.driver(neo4jUrl, neo4j.auth.basic('neo4j', 'neo4jneo4j'));
const session = driver.session();

try {
    // Create nodes for each user
    for (const user of users) {
        await session.run(
            'MERGE (u:User {id: $id, username: $username, access_level: $access_level, is_active: $is_active, lastlog: $lastlog})',
            {
                id: user.id,
                username: user.username,
                access_level: user.access_level,
                is_active: user.is_active,
                lastlog: user.lastlog
            }
        );
    }

    // Create relationships based on connections
    for (const connection of connections) {
        await session.run(
            'MATCH (u1:User {id: $user1_id}), (u2:User {id: $user2_id}) ' +
            'MERGE (u1)-[:KNOWS]->(u2)',
            {
                user1_id: connection.user1_id,
                user2_id: connection.user2_id
            }
        );
    }

    const result = await session.run(
        'MATCH (start:User {username: "Rafał"}), (end:User {username: "Barbara"}), ' +
        'p = shortestPath((start)-[*]-(end)) ' +
        'RETURN [node in nodes(p) | node.username] AS path'
    );

    const path = result.records[0].get('path').join(', ');

    console.log(`Najkrótsza droga od Rafała do Barbary: ${path}`);

    const aiDevsService = new AiDevsService();
    aiDevsService.sendAnswer('connections', path);

} finally {
    await session.close();
    await driver.close();
}