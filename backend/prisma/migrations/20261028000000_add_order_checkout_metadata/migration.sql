ALTER TABLE "Order"
ADD COLUMN "shippingInfo" JSONB,
ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cod';