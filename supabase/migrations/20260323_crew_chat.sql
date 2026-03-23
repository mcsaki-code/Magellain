-- Crew Chat & Direct Messaging
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xqswvroakiogumozedht/sql

-- Crew groups (a team/boat crew that can chat together)
CREATE TABLE IF NOT EXISTS crew_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  boat_id uuid REFERENCES boats(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Crew members (who belongs to which group)
CREATE TABLE IF NOT EXISTS crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES crew_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Crew messages (the actual chat messages)
CREATE TABLE IF NOT EXISTS crew_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES crew_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'location', 'image', 'system')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Direct messages (1:1 between users)
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'location', 'image')),
  metadata jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crew_members_user ON crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_group ON crew_members(group_id);
CREATE INDEX IF NOT EXISTS idx_crew_messages_group ON crew_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_pair ON direct_messages(
  LEAST(sender_id, recipient_id),
  GREATEST(sender_id, recipient_id),
  created_at DESC
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient ON direct_messages(recipient_id, read_at);

-- RLS
ALTER TABLE crew_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view groups they belong to" ON crew_groups
  FOR SELECT USING (id IN (SELECT group_id FROM crew_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create groups" ON crew_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group owners can update" ON crew_groups
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Members can view group members" ON crew_members
  FOR SELECT USING (group_id IN (SELECT group_id FROM crew_members cm WHERE cm.user_id = auth.uid()));

CREATE POLICY "Owners and admins can add members" ON crew_members
  FOR INSERT WITH CHECK (
    group_id IN (SELECT group_id FROM crew_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR group_id IN (SELECT id FROM crew_groups WHERE created_by = auth.uid())
  );

CREATE POLICY "Members can leave or owners can remove" ON crew_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR group_id IN (SELECT group_id FROM crew_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Members can view group messages" ON crew_messages
  FOR SELECT USING (group_id IN (SELECT group_id FROM crew_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can send group messages" ON crew_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND group_id IN (SELECT group_id FROM crew_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their DMs" ON direct_messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send DMs" ON direct_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can mark DMs read" ON direct_messages
  FOR UPDATE USING (recipient_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE crew_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
