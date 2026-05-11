import { ZodBodyPipe } from './zod-body.pipe';
import { DomainHttpException } from './domain-http.exception';
import { z } from 'zod';

describe('ZodBodyPipe', () => {
  const schema = z.object({ code: z.string().min(1) });
  const pipe = new ZodBodyPipe(schema);

  it('解析成功返回推断类型', () => {
    expect(pipe.transform({ code: 'OK' })).toEqual({ code: 'OK' });
  });

  it('校验失败抛出 DomainHttpException', () => {
    expect(() => pipe.transform({})).toThrow(DomainHttpException);
  });
});
