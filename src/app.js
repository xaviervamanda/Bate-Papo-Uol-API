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
console.log(process.env.DATABASE_URL)
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message))

app.post ("/participants", async (req, res) => {
    const {name} = req.body;
    const participant = {name}
    const participantSchema = joi.object({
        name: joi.string().required()
    })

    const validation = participantSchema.validate(participant, {abortEarly: false})
    if(validation.error){
        return res.sendStatus(422)
    }

    try{
        if ((await db.collection("participants").findOne({name: { $regex: name, $options: "i" }})) !== null ){
            return res.sendStatus(409)
        }
        participant.lastStatus = Date.now();
        const date = new Date();
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        await db.collection("participants").insertOne(participant)
        const statusMessage = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: `${hour}:${minutes}:${seconds}`
        }
        console.log(statusMessage)
        await db.collection("messages").insertOne(statusMessage)
        return res.status(201).send("participante adicionado")
    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.get("/participants", async (req, res) => {

    try{
        const participants = await db.collection("participants").find().toArray()
        console.log(participants)
        return res.status(200).send(participants)
    } catch (err) {
        return res.status(500).send(err.message)
    }
})


app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));