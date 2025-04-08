import { diskStorage } from "multer";
import { extname } from "path";
import { mkdirp } from "mkdirp";


export default function MulterStorage(foldername:string){

    return diskStorage({
      destination(req, file, callback) {
        const dir = `./public/uploads/${foldername}`;
        mkdirp.sync(dir);
        callback(null, dir);
      },
      filename(req, file, callback) {
        const format = extname(file.originalname);
        const filename = new Date().getTime().toString() + format;
        callback(null,filename);
      },
    });
    
}