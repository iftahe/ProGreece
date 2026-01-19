from database import engine, SessionLocal
import models

def init_db():
    # 1. יצירת הטבלאות (אם הן לא קיימות)
    print("Creating database tables...")
    models.Base.metadata.create_all(bind=engine)
    
    # 2. יצירת פרויקט ברירת מחדל (כדי שלתנועות יהיה לאן להשתייך)
    db = SessionLocal()
    project = db.query(models.Project).first()
    
    if not project:
        print("Creating default project 'Athens Luxury'...")
        new_project = models.Project(name="Athens Luxury", status="Active")
        db.add(new_project)
        db.commit()
    else:
        print(f"Project '{project.name}' already exists.")
        
    db.close()
    print("Initialization Complete! You can now run the imports.")

if __name__ == "__main__":
    init_db()