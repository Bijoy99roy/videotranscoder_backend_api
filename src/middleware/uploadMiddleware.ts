import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads")
    },
    filename: function (req, file, cb) {
        const fileName = uuidv4() + path.extname(file.originalname);
        cb(null, fileName)
    },
})

const upload = multer({ storage: storage})

export = upload;