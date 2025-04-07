import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { WsBadRequestException } from '../exceptions';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class WsValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const object = plainToClass(metadata.metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const errorMessages = errors.map(error => {
        const constraints = error.constraints || {};
        return Object.values(constraints).join(', ');
      }).join('; ');
      
      throw new WsBadRequestException(`Validation failed: ${errorMessages}`);
    }
    
    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
} 