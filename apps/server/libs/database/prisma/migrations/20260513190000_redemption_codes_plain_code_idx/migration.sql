-- 兑换接口优先按明文列查找，`plain_code` 索引用以降低列表页批量带出后的兑换延迟。
CREATE INDEX `redemption_codes_plain_code_idx` ON `redemption_codes` (`plain_code`);
