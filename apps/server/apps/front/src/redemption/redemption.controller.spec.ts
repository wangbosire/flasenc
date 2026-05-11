import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedemptionController } from './redemption.controller';
import { RedemptionService } from './redemption.service';

describe('RedemptionController', () => {
  let controller: RedemptionController;
  const redeemMock = jest.fn();

  beforeEach(async () => {
    redeemMock.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedemptionController],
      providers: [
        { provide: RedemptionService, useValue: { redeem: redeemMock } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context
            .switchToHttp()
            .getRequest<{ memberId?: string }>();
          req.memberId = '00000000-0000-4000-8000-0000000000aa';
          return true;
        },
      })
      .compile();

    controller = module.get(RedemptionController);
  });

  it('将兑换委托给 RedemptionService（注入 JWT 解析后的 memberId）', async () => {
    redeemMock.mockResolvedValue({
      contentId: 'c1',
      ownerMemberId: '00000000-0000-4000-8000-0000000000aa',
    });
    const out = await controller.redeem(
      {
        memberId: '00000000-0000-4000-8000-0000000000aa',
        headers: {},
      },
      { code: 'CODE' },
    );
    expect(out).toEqual({
      contentId: 'c1',
      ownerMemberId: '00000000-0000-4000-8000-0000000000aa',
    });
    expect(redeemMock).toHaveBeenCalledWith({
      memberId: '00000000-0000-4000-8000-0000000000aa',
      plainCode: 'CODE',
    });
  });
});
