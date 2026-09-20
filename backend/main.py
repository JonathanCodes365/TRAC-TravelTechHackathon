from pydantic import BaseModel, Field

from fastapi import FastAPI, Depends , HTTPException, BackgroundTasks
#import fastapi so that python can create a web api.
from backend.schemas import Report,Reporttype,ReportResponse,ReportStatus,ReportUpdate

#Now ,we want to sure that our API endpoints get access to the Session-->database.
#get_db is the function which contais db which is an object of sessionLocal() and it calls it
from backend.database import get_db
#Session is us doing groundwork and saying we are going to ensure sessions to our endpoints here.
from sqlalchemy.orm import Session

from backend.models import ReportModel

# Talks to the AI service (ai-service/, port 8001) for the backend.
from backend import ai
from sqlalchemy import text

#we added CORSMiddleware here
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


class AnalyzeRequest(BaseModel):
    # min_length=1 so an empty message isn't sent to the AI.
    report_text: str = Field(min_length=1, max_length=2000)

# The AI's words (missing, injured, rescued, safe) are translated to our report types in
# backend/ai.py (ai.AI_STATUS_TO_REPORT_TYPE). Careful: "rescued" means already safe.


@app.post("/reports/analyze")
def analyze_report(request: AnalyzeRequest):
    # Ask the AI what a message is about before it's sent, so the report form can
    # suggest a type while someone types.
    #8001- server for AI
    #8000- server for backend
    # The backend talks to the AI for the frontend, so the frontend only needs the backend's address.
    try:
        ai_result = ai.extract(request.report_text)
    except ai.AIUnavailable:
        raise HTTPException(
            status_code=503,
            detail="The AI service isn't available right now."
        )

    report_type = ai.suggested_type(ai_result)

    return {
    "message": request.report_text,
    "suggested_report": {
        # None when the AI can't tell, rather than guessing "incident".
        "type": report_type.value if report_type else None,
        "status": ReportStatus.OPEN.value,
        "location": ai_result.get("location"),
        "people_count": ai.people_count(ai_result.get("people_count")),
        "name": ai.person_name(ai_result.get("name")),
    },
    # "rules" when the AI used its keyword rules, "model" when a language model answered.
    "source": "rules" if ai_result.get("_mock") else "model",
    "ai_analysis": ai_result,
    }

#added for CORS here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#this creates our fastapi application.
details = {
    "project":"TRAC",
    "purpose":"Tourism disaster coordination"
}
reports_response = {
    "message":"Report received"
}
@app.put("/reports/{report_id}",response_model=ReportResponse)
def update_report(report_id:int , to_update_report: Report, background_tasks: BackgroundTasks, db:Session = Depends(get_db)):
    existing_report = db.query(ReportModel).filter(ReportModel.id ==report_id).first()


    if existing_report is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    #now , here after making sure existing_report is actually in the database.
    #we need to replace the data of the attributes of this report .
    existing_report.type = to_update_report.type
    existing_report.message=to_update_report.message
    existing_report.location=to_update_report.location
    #doing only this much doesnt actuallyy permanently cause save changes to the postgre table.
    #cause we have shown the system here that : we have made changes to the object of ours.
    #but we havent yet committed it yet.

    #doing the same for latitude and longitude
    existing_report.incident_latitude = to_update_report.incident_latitude
    existing_report.incident_longitude = to_update_report.incident_longitude

    existing_report.reporter_latitude = to_update_report.reporter_latitude
    existing_report.reporter_longitude = to_update_report.reporter_longitude

    # The text changed, so ask the AI to check the report again.
    existing_report.ai_state = "pending"
    db.commit()
    background_tasks.add_task(ai.enrich_report, existing_report.id)
    return existing_report

@app.patch("/reports/{report_id}", response_model=ReportResponse)
def patch_report(report_id: int, changes: ReportUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # PUT replaces the whole report. PATCH only changes the fields that are sent,
    # e.g. {"status": "resolved"} when a coordinator closes a report.
    existing_report = db.query(ReportModel).filter(ReportModel.id == report_id).first()

    if existing_report is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )

    # exclude_unset=True gives only the fields that were actually in the request.
    fields = changes.model_dump(exclude_unset=True)

    if "duplicate_state" in fields:
        if existing_report.duplicate_of is None:
            raise HTTPException(
                status_code=400,
                detail="This report has no possible duplicate to confirm or dismiss"
            )
        # A confirmed duplicate is covered by the earlier report, so it's closed too.
        if fields["duplicate_state"] == "confirmed" and "status" not in fields:
            fields["status"] = ReportStatus.RESOLVED

    for field, value in fields.items():
        if isinstance(value, ReportStatus):
            value = value.value  # the status column stores plain text like "resolved"
        setattr(existing_report, field, value)

    # If the words or the place changed, ask the AI to check the report again.
    recheck = bool({"type", "message", "location"} & fields.keys())
    if recheck:
        existing_report.ai_state = "pending"
    db.commit()
    if recheck:
        background_tasks.add_task(ai.enrich_report, existing_report.id)
    return existing_report

@app.post("/reports/{report_id}/analyze", response_model=ReportResponse, status_code=202)
def reanalyze_report(report_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Run the AI check again, e.g. after the AI service was down (ai_state "failed").
    # 202 means "Accepted": the AI's answer shows up on the report a moment later.
    existing_report = db.query(ReportModel).filter(ReportModel.id == report_id).first()

    if existing_report is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )

    existing_report.ai_state = "pending"
    db.commit()
    background_tasks.add_task(ai.enrich_report, existing_report.id)
    return existing_report

@app.get("/") 
#when someone sends a get request to /
#use the function below.
def home():
    return{"message":"TRAC is running"}

@app.get("/about")
def about():
    return details

@app.get("/health")
def health(db: Session = Depends(get_db)):
    # Whether every part of TRAC is working: this API, the database and the AI service.
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "error"
    ai_health = ai.health()
    return {
        "api": "ok",
        "database": database,
        "ai": "ok" if ai_health else "unavailable",
        # How the AI reads messages: "rules" (keywords) or a provider such as "openai".
        "ai_extraction": ai_health.get("extraction") if ai_health else None,
    }

@app.get("/reports/{report_id}", response_model=ReportResponse)
# here we are saying this endpoint returns one report,
# and that response/response_model must follow the ReportResponse schema.

def retrieve_reports(report_id: int, db: Session = Depends(get_db)):

    report_records = db.query(ReportModel).filter(ReportModel.id == report_id).first()

    if report_records is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )

    # report_id comes from the URL: /reports/{report_id}
    # We query ReportModel, which is mapped to the "reports" table.
    # Then we filter the table based on its id.
    # We compare the id in the database with the report_id
    # that came from the URL.
    # If they match, .first() gives us that report.

    #after following the schema you will get your data from here.

   #report_records =db.query(ReportModel).all()
   #This would have gave us all the details of ReportModel after querying ....

    return report_records
    
    #This means ; use this query session to query the table represented by ReportModel

@app.get("/reports", response_model=list[ReportResponse])
def retrieve_all_reports(type:Reporttype | None = None, 
                         location :str |None= None,
                         status: ReportStatus | None = None,
                         db:Session = Depends(get_db)):
    query = db.query(ReportModel)

    if type is not None:
        query = query.filter(ReportModel.type ==type)
    if location is not None:
        query = query.filter(ReportModel.location.icontains(location, autoescape=True))

        # here we replaced == with ilike ... what ilike does it looks for 
        # similarity patterns between ReportModel.Location and location.

        #for example: the user enters pokhara and our database Contains Pokhara..
        #nowe due to the ilike it looks for pattern.. and since pokhara is quite similar to Pokhara... it will show the same .. 

        # icontains is ilike with % around the text, so part of a name also matches:
        # "pokh" finds "Lakeside, Pokhara". Plain ilike("pokhara") only matched the exact text.
    if status is not None:
        query = query.filter(ReportModel.status == status.value)

    # Newest reports first (without order_by, the database can return rows in any order).
    report_records = query.order_by(ReportModel.id.desc()).all()
    return report_records




# status_code=201 means "Created", the standard answer when a new record is made.
@app.post("/reports", response_model = ReportResponse, status_code=201)
def receive_reports(report:Report,
                    background_tasks: BackgroundTasks,
                    db: Session = Depends(get_db)):
    
    #This function is actually telling us: Take the incoming request from the body 
    #and put it into the report variable after validating as a Report(pydantic with Report).

    #db: Session =Depends(get_db)
    #It means FastApi , give this endpoint a SQLAlchemySession by running get_db.

    #Depends is a FastAPI injection mechanism .
    #For example here we can see Depends(get_db) it means: go inside get_db and get me everything.
    #Using depends allows us to be as efficient as possible and allows us to add the session code in wherever
    #we want with just applying depends(...)


    if report.type  == Reporttype.RESCUE:
        print("This is an rescue alert!")
    else:
        print("XYZ")

    print(report.type)
    #this gives our enum member..
    #we have explicitly stated type to be Reporttype.. in our schemas.py
    
    print(report.message)
    print(report.location)
    #ReportModel is from our models.py which means it is a SQL alchemy model
    #since we are doing new_report = ReportModel(....)
    #This means we are making new_report it's object and calling it ...
    new_report = ReportModel(
        #this report are the values we get after pydantic model does it work
        type = report.type,
        message = report.message,
        location = report.location,
        incident_latitude = report.incident_latitude,
        incident_longitude = report.incident_longitude,

        reporter_latitude = report.reporter_latitude,
        reporter_longitude = report.reporter_longitude

        #so we are telling the system this is our database model for receive_report and this is how it must seem.
    )

    #before db.add.... we have created a SQLAlchemy object and have not done yet anything in PostgreSQL yet..
    db.add(new_report)
    #we know db represents session.
    #so this code does is ... Session ; start tracking this object new_report 
    # because i want it to become a database record.
    #but still notice that we are only tracking and there 
    # is no thing yet that we have pushed .. we use commit for this.
    # The AI checks the report after the response is sent, so the reporter never waits for it.
    new_report.ai_state = "pending"
    db.commit()
    background_tasks.add_task(ai.enrich_report, new_report.id)
    return new_report


@app.delete("/reports/{report_id}")
def delete_reports(report_id:int , db:Session=Depends(get_db)):
    existing_report = db.query(ReportModel).filter(ReportModel.id == report_id).first()

    if existing_report is None:
        raise HTTPException(
            status_code = 404,
            detail= "Report not found"
        )

    # Reports that pointed at this one as a possible duplicate lose that link.
    db.query(ReportModel).filter(ReportModel.duplicate_of == report_id).update(
        {"duplicate_of": None, "duplicate_score": None, "duplicate_state": None},
        synchronize_session=False,
    )
    db.delete(existing_report)
    db.commit()
    return {"message": "Report deleted successfully"}