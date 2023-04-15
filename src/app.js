import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";

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

app.post ("/participants", async (req, res) => {
    const {name} = req.body;
    const participant = {name};
    const participantSchema = joi.object({
        name: joi.string().required()
    });

    const validation = participantSchema.validate(participant, {abortEarly: false})
    if(validation.error){
        return res.sendStatus(422);
    }

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
    const {to, text, type} = req.body;
    const {user} = req.headers;

    const message = {to, text, type};

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()
    });

    const validation = messageSchema.validate(message);
    if (validation.error){
        return res.sendStatus(422);
    }

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


app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));