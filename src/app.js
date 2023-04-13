import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
dotenv.config;

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message))

app.post ("/participants", (req, res) => {
    const {name} = req.body;
    //validar com joi
})

app.get("/participants", (req, res => {
    db.collection("participants").find().toArray()
        .then(participants => res.status(200).send(participants))
        .catch(err => res.status(500).send(err.message))
}))


app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));