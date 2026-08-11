from database import engine
from sqlalchemy import text, inspect
import asyncio

async def add_columns():
    async with engine.begin() as conn:
        columns = await conn.run_sync(lambda sc: [c['name'] for c in inspect(sc).get_columns('users')])
        print('Current columns:', columns)
        
        if 'years_of_experience' not in columns:
            await conn.execute(text('ALTER TABLE users ADD COLUMN years_of_experience INTEGER'))
            print('Added years_of_experience')
        else:
            print('years_of_experience already exists')
        
        if 'ai_provider' not in columns:
            await conn.execute(text('ALTER TABLE users ADD COLUMN ai_provider VARCHAR(50)'))
            print('Added ai_provider')
        else:
            print('ai_provider already exists')
        
        if 'ai_api_key' not in columns:
            await conn.execute(text('ALTER TABLE users ADD COLUMN ai_api_key VARCHAR(500)'))
            print('Added ai_api_key')
        else:
            print('ai_api_key already exists')
        
        print('DB migration complete!')

asyncio.run(add_columns())
