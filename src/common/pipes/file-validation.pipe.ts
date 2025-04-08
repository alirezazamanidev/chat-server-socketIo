import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

interface Option {
  required?: boolean;
  allowedTypes: string[];
  maxSize: number;
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private required: boolean;
  private allowedTypes: string[];
  private maxSize: number;

  constructor(private readonly options: Option = { required: true, allowedTypes: [], maxSize: 0 }) {
    this.required = options.required ?? true;
    this.allowedTypes = options.allowedTypes;
    this.maxSize = options.maxSize;
  }

  transform(file: Express.Multer.File) {
    if (!file) {
      if (!this.required) {
        return file;
      }
      throw new BadRequestException('فایل آپلود نشده است');
    }

    // بررسی پسوند فایل
    const fileExtension = file.originalname.split('.').pop();
    if (!fileExtension || !this.allowedTypes.includes(fileExtension.toLowerCase())) {
      throw new BadRequestException(
        `فرمت فایل نامعتبر است. فرمت‌های مجاز: ${this.allowedTypes.join(', ')}`
      );
    }

    // بررسی سایز فایل
    if (file.size > this.maxSize) {
      const maxSizeInMB = this.maxSize / (1024 * 1024);
      throw new BadRequestException(
        `سایز فایل باید کمتر از ${maxSizeInMB} مگابایت باشد`
      );
    }

    return file;
  }
}