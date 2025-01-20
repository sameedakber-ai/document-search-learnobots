from .models import ProcessingJob, ElementResult
from .helpers import DocumentLoader, KnowledgeGenerator

def load_elements(processing_job_id):
    processing_job = ProcessingJob.objects.get(pk=processing_job_id)
    processing_job.start()

    try:
        loaded_documents = DocumentLoader.load(processing_job.document)
        element_result = ElementResult.objects.create(
            document=processing_job.document,
            processing_job=processing_job,
        )
        element_result.set_elements(loaded_documents)
        element_result.save()
        processing_job.complete()

    except Exception as e:
        print(e)
        processing_job.fail()

    return processing_job

def generate_knowledge(processing_job_id):
    processing_job = ProcessingJob.objects.get(pk=processing_job_id)
    processing_job.start()

    documents = KnowledgeGenerator.generate_knowledge(processing_job.document.element_results.elements)

    if documents:
        processing_job.complete()
    else:
        processing_job.fail()

    return documents




