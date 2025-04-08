import { FileInterceptor } from '@nestjs/platform-express';
import MulterStorage from '../utils/multer';

export function UploadFile(filedName: string, foldername: string) {
  return class UploadUtility extends FileInterceptor(filedName, {
    storage: MulterStorage(foldername),
  }) {};
}
