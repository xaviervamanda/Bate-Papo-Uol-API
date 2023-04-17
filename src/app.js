import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import { stripHtml } from "string-strip-html";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
dotenv.config();

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message))

const date = new Date();
const hour = date.getHours();
const minutes = date.getMinutes();
const seconds = date.getSeconds();
const dateTime = `${hour}:${minutes}:${seconds}`;

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required()
});

app.post ("/participants", async (req, res) => {
    let {name} = req.body;
    const participantSchema = joi.object({
        name: joi.string().required()
    });

    const validation = participantSchema.validate({name}, {abortEarly: false})
    if(validation.error){
        return res.sendStatus(422);
    }

    name = (stripHtml(name).result).trim();
    const participant = {name};

    try{
        if ((await db.collection("participants").findOne({name: { $regex: name, $options: "i" }})) !== null ){
            return res.sendStatus(409);
        }
        participant.lastStatus = Date.now();
        await db.collection("participants").insertOne(participant);
        const statusMessage = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dateTime
        };
        await db.collection("messages").insertOne(statusMessage);
        return res.status(201).send("participante adicionado");
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

app.get("/participants", async (req, res) => {

    try{
        const participants = await db.collection("participants").find().toArray();
        return res.status(200).send(participants);
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

app.post("/messages", async (req, res) => {
    let {to, text, type} = req.body;
    const {user} = req.headers;

    const validation = messageSchema.validate({to, text, type});
    if (validation.error){
        return res.sendStatus(422);
    }

    to = (stripHtml(to).result).trim();
    text = (stripHtml(text).result).trim();
    type = (stripHtml(type).result).trim();
    const message = {to, text, type};

    try{
        const userValidation = await db.collection("participants").findOne({name: user});
        if(!userValidation){
            return res.sendStatus(422);
        }
        message.time = dateTime;
        message.from = user;
        await db.collection("messages").insertOne(message);
        return res.sendStatus(201);
    } catch (err){
        return res.status(500).send(err.message);
    }
});

app.get("/messages", async (req, res) => {
    const {user} = req.headers;
    const {limit} = req.query;

    if (!limit || Number(limit) <= 0 || !(/^\d+$/.test(limit))){
        return res.sendStatus(422);
    }

    try{
        const permitedMessages = await db.collection("messages").find({$or: [{to: "Todos"}, {to: `${user}`}, {from: `${user}`}]}).toArray();
        if (limit){
            const messages = [...permitedMessages];
            messages.reverse();
            return res.send(messages.slice(0,Number(limit)));
        }
        return res.send(permitedMessages);
    } catch (err){
        return res.status(500).send(err.message);
    }
});

app.post ("/status", async (req, res) => {
    const {user} = req.headers;
    
    const lastStatus = { lastStatus: Date.now()};

    if (!user){
        return res.sendStatus(404);
    }

    try{
        const userValidation = await db.collection("participants").findOne({name: user});
        if (!userValidation){
            return res.sendStatus(404);
        }
        await db.collection("participants").updateOne({name: user}, {$set: lastStatus});
        return res.sendStatus(200);
    } catch (err){
        return res.status(500).send(err.message);
    }
});

app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const {user} = req.headers;
    const {ID_DA_MENSAGEM} = req.params;
    try{
        const searchedMessage = await db.collection("messages").findOne({_id: new ObjectId(ID_DA_MENSAGEM)});
        if (!searchedMessage){
            return res.sendStatus(404);
        }
        if (searchedMessage.from !== user){
            return res.sendStatus(401);
        }
        await db.collection("messages").deleteOne({_id: new ObjectId(ID_DA_MENSAGEM)});
        res.sendStatus(200);
    } catch (err){
        return res.status(500).send(err.message);
    }
    
});

app.put("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    let {to, text, type} = req.body;
    const {user} = req.headers;
    const {ID_DA_MENSAGEM} = req.params;

    const validation = messageSchema.validate({to, text, type});
    if (validation.error){
        return res.sendStatus(422);
    }

    to = (stripHtml(to).result).trim();
    text = (stripHtml(text).result).trim();
    type = (stripHtml(type).result).trim();

    const updateMessage = {
        from: user,
        to,
        text,
        type,
        time: dateTime
    };

    try{
        const searchedMessage = await db.collection("messages").findOne({_id: new ObjectId(ID_DA_MENSAGEM)});
        if (!searchedMessage){
            return res.sendStatus(404);
        }
        if (searchedMessage.from !== user){
            return res.sendStatus(401);
        }
        await db.collection("messages").updateOne({_id: new ObjectId(ID_DA_MENSAGEM)}, {$set: updateMessage});
        return res.sendStatus(200);
    } catch (err){
        return res.status(500).send(err.message);
    }
});

setInterval(async () => {
    try{
        const now = Date.now();
        const desativeParticipants = await db.collection("participants").find({lastStatus: {$lt: (now-10000)}}).toArray();
        desativeParticipants.forEach(async (participant) => {
            await db.collection("participants").deleteOne({name: participant.name});
            const statusMessage = {
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dateTime
            };
            await db.collection("messages").insertOne(statusMessage);
        });
    } catch (err){
        return res.status(500).send(err.message);
    }
    
}, 15000)

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));