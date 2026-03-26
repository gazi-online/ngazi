-- Run this script in the Supabase SQL Editor to create your database tables

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) UNIQUE NOT NULL,
    "email" VARCHAR(255),
    "password" TEXT NOT NULL,
    "role" VARCHAR(20) DEFAULT 'user',
    "isVerified" BOOLEAN DEFAULT false,
    "isActive" BOOLEAN DEFAULT true,
    "lastLogin" TIMESTAMPTZ,
    "otpCode" VARCHAR(10),
    "otpExpiresAt" TIMESTAMPTZ,
    "pushToken" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "trackingId" VARCHAR(50) UNIQUE NOT NULL,
    "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "whatsapp" VARCHAR(20),
    "address" VARCHAR(500) NOT NULL,
    "city" VARCHAR(100),
    "service" VARCHAR(50) NOT NULL,
    "serviceDetails" TEXT,
    "appointmentDate" TIMESTAMPTZ NOT NULL,
    "appointmentTime" VARCHAR(50) NOT NULL,
    "documents" JSONB DEFAULT '[]'::JSONB,
    "payment" JSONB DEFAULT '{"status": "pending", "amount": 0}'::JSONB,
    "status" VARCHAR(50) DEFAULT 'pending',
    "adminNotes" TEXT,
    "processedBy" VARCHAR(100),
    "timeline" JSONB DEFAULT '[]'::JSONB,
    "whatsappSent" BOOLEAN DEFAULT false,
    "isDeleted" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Trigger to auto-update updatedAt
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_bookings_timestamp
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE PROCEDURE update_timestamp();
